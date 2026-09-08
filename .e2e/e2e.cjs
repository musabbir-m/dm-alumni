/* Clerk migration e2e — runs against the live dev server on :3000.
 * Uses a +clerk_test email so the verification code is the fixed 424242.
 * Bot protection: the instance runs Turnstile ("smart" widget) on sign-up,
 * and Turnstile's challenge orchestration hosts (<name>.challenges.cloudflare.com)
 * don't resolve on this network — so the challenge can never complete. Clerk's
 * sanctioned bypass is the Testing Token: clerkSetup() fetches one from the
 * Backend API (reads NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY from
 * .env.local itself), and setupClerkTestingToken() routes FAPI traffic through
 * it and marks the client captcha_bypass=true. */
const { chromium } = require('playwright');
const { clerkSetup, setupClerkTestingToken } = require('@clerk/testing/playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const FAPI = 'https://evident-ocelot-8419.clerk.accounts.dev';
const OUT = path.join(__dirname, 'artifacts');
fs.mkdirSync(OUT, { recursive: true });

const EMAIL = `e2e${Date.now()}+clerk_test@example.com`;
const PASSWORD = 'TestPass!2026xyz'; // Clerk instance enforces 15+ chars
const NEW_PASSWORD = 'NewPass!2026xyz';
const STUDENT_ID = `E2E-${Date.now() % 100000}`;

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 72 720 Td (E2E test) Tj ET\nendstream endobj\ntrailer<</Size 5/Root 1 0 R>>\n%%EOF',
  'utf8'
);

const log = (...a) => console.log('[e2e]', ...a);
let failures = 0;
let browserRef = null; // closed on fatal — otherwise node wedges holding chromium
const errors = [];
const check = (name, ok) => {
  log(ok ? `PASS ${name}` : `FAIL ${name}`);
  if (!ok) failures++;
};

async function main() {
  await clerkSetup();
  // Clerk's cookieless-dev handshake 307-loops in this Chromium: the dance
  // returns Set-Cookie __clerk_db_jwt/__client_uat with `Secure; SameSite=None`
  // which never land on http://localhost, so the middleware re-redirects
  // forever (ERR_TOO_MANY_REDIRECTS; curl with a jar completes fine, so the
  // server side is healthy). Bypass: create the dev browser ourselves and use
  // Clerk's documented URL-param sync (__clerk_db_jwt) on every direct
  // navigation — clerk-js adopts the token and appends it to its own
  // navigations too (url_based_session_syncing: true).
  const dbRes = await fetch(`${FAPI}/v1/dev_browser`, { method: 'POST' });
  const devBrowser = await dbRes.json();
  if (!devBrowser.token) throw new Error('could not create Clerk dev browser: ' + JSON.stringify(devBrowser).slice(0, 200));
  const DVB = `__clerk_db_jwt=${devBrowser.token}`;
  const browser = browserRef = await chromium.launch({
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  // Mask automation signals — captcha/bot protection can hang the submit
  // silently (spinner forever, no network request) when it detects webdriver.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();
  await setupClerkTestingToken({ page });
  // Direct navigations bypass clerk-js, so they need the dev-browser param
  // appended manually (see the dev_browser note above).
  const goto = (path) => page.goto(
    BASE + path + (path.includes('?') ? '&' : '?') + DVB,
    { waitUntil: 'domcontentloaded', timeout: 60000 }
  );
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // Ground truth for Clerk failures: log every Clerk API round-trip.
  // Requests are logged at DISPATCH time too — distinguishes "POST never
  // left the browser" from "POST sent, no response".
  page.on('request', (req) => {
    const url = req.url();
    if (req.method() !== 'GET' && url.includes('clerk')) {
      log(`CLERK ${req.method()} dispatched → ${url.split('?')[0]}`);
    }
    if (/captcha|turnstile|challenges\.cloudflare|hcaptcha/i.test(url)) {
      log(`CAPTCHA asset ${req.method()} ${url.split('?')[0]}`);
    }
  });
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('clerk') && url.includes('/v1/')) {
      const cap = url.includes('/environment') ? 4000 : 600;
      let body = '';
      try { body = (await res.text()).slice(0, cap); } catch {}
      log(`CLERK API ${res.status()} ${url.split('?')[0]}\n  ${body}`);
    }
  });
  // ALL domains — captcha widget scripts load from non-clerk hosts
  page.on('requestfailed', (req) => {
    log(`REQUEST FAILED ${req.method()} ${req.url().split('?')[0]} — ${req.failure()?.errorText}`);
  });

  const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`), fullPage: false });

  // 1. Anonymous home
  await goto('/');
  await page.waitForTimeout(1200);
  check('home shows Join CTA', await page.getByText('Join the Network').first().isVisible());

  // 2. Sign-up (Clerk form — email input is `emailAddress` on sign-up,
  // `identifier` on sign-in; match both)
  const emailField = 'input[name="identifier"], input[name="emailAddress"]';
  await goto('/sign-up');
  const hasEmail = await waitFor(() => page.locator(emailField).count());
  check('sign-up email field present', !!hasEmail);
  const hasFirstName = (await page.locator('input[name="firstName"]').count()) > 0;
  const hasLastName = (await page.locator('input[name="lastName"]').count()) > 0;
  log('dashboard name fields on sign-up:', { hasFirstName, hasLastName });
  if (hasFirstName) await page.locator('input[name="firstName"]').fill('Test');
  if (hasLastName) await page.locator('input[name="lastName"]').fill('Alumni');
  await page.locator(emailField).first().fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await shot('signup-filled');
  await primaryContinue(page);

  // 3. Email verification code (test address → 424242), unless auto-skipped
  const codeSel = 'input[name="code"], input[autocomplete="one-time-code"]';
  await shot('after-continue');
  const codeInput = await waitFor(() => page.locator(codeSel).count(), 8000);
  if (codeInput) {
    await page.locator(codeSel).first().fill('424242');
    await shot('signup-code');
    // Clerk auto-submits the OTP when the last digit lands, so the Continue
    // button is usually already loading/detached by now — best-effort click.
    await primaryContinue(page).catch(() => log('OTP Continue click skipped (auto-submitted)'));
  } else {
    log('no code screen — verification not required at sign-up (url:', page.url(), ')');
  }
  await shot('post-continue-settled');

  // 4. Should land on /register with locked email
  await page.waitForURL('**/register', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot('register');
  const lockedEmail = await page.locator('#clerkEmail').inputValue();
  check('register shows locked Clerk email', lockedEmail.toLowerCase() === EMAIL);
  const lockedName = await page.locator('#clerkName').inputValue();
  log('locked name on /register:', JSON.stringify(lockedName));

  // 5. Complete profile
  await page.locator('#phone').fill('+8801712345678');
  await page.locator('#studentId').fill(STUDENT_ID);
  await page.locator('#batch').selectOption('2019');
  await page.setInputFiles('#photo', { name: 'photo.png', mimeType: 'image/png', buffer: PNG });
  await page.setInputFiles('#document', { name: 'doc.pdf', mimeType: 'application/pdf', buffer: PDF });
  await page.waitForTimeout(500);
  await shot('register-filled');
  await page.getByRole('button', { name: /Complete registration/i }).click();

  // 6. Success panel
  await page.waitForSelector('text=Welcome aboard', { timeout: 60000 });
  check('complete-profile success panel', true);
  await page.getByRole('link', { name: /Go to your profile/i }).click();
  await page.waitForURL('**/profile');

  // 7. Profile assertions
  await page.waitForTimeout(1500);
  await shot('profile');
  const body = await page.textContent('main');
  check('profile: name rendered', /Test\s*Alumni|Test|Alumni|e2e\d+/.test(body));
  check('profile: pending badge', body.includes('Pending verification'));
  const photoSrc = await page.locator('main img[alt]').first().getAttribute('src').catch(() => null);
  check('profile: cloudinary photo', !!photoSrc && photoSrc.includes('res.cloudinary.com'));
  log('photo url:', photoSrc);
  check('profile: doc link', body.includes('View your verification document'));

  // 8. Guard: complete user visiting /register → bounced to /profile
  await goto('/register');
  await page.waitForTimeout(1200);
  check('complete user on /register → /profile', page.url().includes('/profile'));

  // 9. Sign out via profile LogoutButton, land on /
  await page.getByRole('button', { name: 'Log out' }).first().click();
  await page.waitForURL(BASE + '/');
  await page.waitForTimeout(1200);
  check('sign-out lands on home', true);

  // 10. Sign back in
  await goto('/sign-in');
  await waitFor(() => page.locator(emailField).count());
  await page.locator(emailField).first().fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await primaryContinue(page);
  await page.waitForURL('**/profile', { timeout: 30000 });
  check('sign-in returns to /profile', true);

  // 11. Password reset ("Forgot password?" on /sign-in) — best effort
  await page.getByRole('button', { name: 'Log out' }).first().click();
  await page.waitForURL(BASE + '/');
  await goto('/sign-in');
  await waitFor(() => page.locator(emailField).count());
  let resetOk = false;
  try {
    const forgotSel = /Forgot password|reset your password/i;
    // Two passes: if the transient "Forgot Password?" card auto-dismissed
    // before we could click its "Reset your password" primary, the
    // wrong-password dance brings the forgot link back for another try.
    let hasCode = false;
    for (let pass = 0; pass < 2 && !hasCode; pass++) {
      let forgot = page.getByText(forgotSel).first();
      if (!(await forgot.isVisible().catch(() => false))) {
        // clerk-js v6 sign-in is step-based: identifier first, the forgot
        // link lives on the password step. Fill the identifier, submit a
        // wrong password — its error state surfaces the reset link too.
        await page.locator(emailField).first().fill(EMAIL);
        await page.waitForTimeout(1000);
        const pwNow = page.locator('input[name="password"]');
        if (await pwNow.count()) await pwNow.first().fill('WrongOld!pass123');
        await primaryContinue(page);
        await shot(`reset-after-continue-${pass}`);
        forgot = page.getByText(forgotSel).first();
        await forgot.waitFor({ timeout: 10000 });
      }
      await forgot.click();
      await shot(`reset-forgot-${pass}`);
      // v6 forgot card: primary is "Reset your password" (alternatives
      // listed below). That card's buttons are NOT cl-formButtonPrimary and
      // the card can revert to the identifier step on its own — so click by
      // accessible name the moment it's visible, with a DOM-event fallback
      // in case an entrance animation defeats Playwright's actionability
      // check (dispatchEvent still triggers React's delegated listeners).
      const resetBtn = page.getByRole('button', { name: /reset your password/i }).first();
      if (await waitFor(() => resetBtn.isVisible(), 5000)) {
        await resetBtn.click({ timeout: 5000 }).catch(() => resetBtn.dispatchEvent('click'));
        await shot(`reset-reset-clicked-${pass}`);
      }
      // Then either the code screen directly (the fresh attempt knows the
      // identifier via safe_identifier) or an identifier re-ask first.
      hasCode = await waitFor(() => page.locator(codeSel).count(), 15000);
      if (!hasCode) {
        const emailAgain = page.locator(emailField).first();
        if (await emailAgain.isVisible().catch(() => false)) {
          await emailAgain.fill(EMAIL);
          await primaryContinue(page);
          // may land on the password step instead — the loop's next pass
          // re-enters via the forgot link visible there.
          hasCode = await waitFor(() => page.locator(codeSel).count(), 8000);
        }
      }
    }
    if (!hasCode) throw new Error('no code screen after reset request (url: ' + page.url() + ')');
    await page.locator(codeSel).first().fill('424242');
    await shot('reset-code');
    await primaryContinue(page).catch(() => {}); // OTP may auto-submit
    await waitFor(() => page.locator('input[type="password"]').count(), 10000);
    // v6 "Set new password" screen is a confirm-password PAIR — fill every
    // password input, not just input[name="password"].
    const pwInputs = page.locator('input[type="password"]');
    const pwCount = await pwInputs.count();
    for (let i = 0; i < pwCount; i++) await pwInputs.nth(i).fill(NEW_PASSWORD);
    await shot('reset-newpass');
    // Its primary is "Reset Password" — again without cl-formButtonPrimary.
    const resetPwBtn = page.getByRole('button', { name: /^reset\s+password$/i }).first();
    if (await waitFor(() => resetPwBtn.isVisible(), 5000)) {
      await resetPwBtn.click({ timeout: 5000 }).catch(() => resetPwBtn.dispatchEvent('click'));
    } else {
      await primaryContinue(page);
    }
    await page.waitForTimeout(4000);
    await shot('after-reset');
    // Completing the reset signs the user in directly — sign out so the
    // NEW_PASSWORD sign-in below actually proves the password changed.
    await page.getByRole('button', { name: 'Log out' }).first().click().catch(() => {});
    await page.waitForURL(BASE + '/').catch(() => {});
    await goto('/sign-in');
    await waitFor(() => page.locator(emailField).count());
    await page.locator(emailField).first().fill(EMAIL);
    await page.waitForTimeout(800);
    const pw = page.locator('input[name="password"]');
    if (!(await pw.count())) {
      await primaryContinue(page);
      await waitFor(() => pw.count(), 10000);
    }
    await pw.first().fill(NEW_PASSWORD);
    await primaryContinue(page);
    await page.waitForURL('**/profile', { timeout: 30000 });
    resetOk = true;
  } catch (e) {
    log('password-reset flow could not be completed:', e.message.split('\n')[0]);
    await shot('reset-failed').catch(() => {});
  }
  check('password reset + new password sign-in', resetOk);

  log('page errors seen:', errors.length ? errors : 'none');
  await browser.close();
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exitCode = failures ? 1 : 0;
}

// Clicks Clerk's primary submit. Never matches "Continue with Google" —
// that button also contains the text "Continue" and sits earlier in the DOM.
async function primaryContinue(page) {
  const btn = page.locator('button.cl-formButtonPrimary').first();
  if (await btn.count()) return btn.click();
  return page.getByRole('button', { name: 'Continue', exact: true }).first().click();
}

async function waitFor(fn, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

main().catch(async (e) => {
  console.error('[e2e] fatal:', e);
  if (errors.length) console.error('[e2e] page errors:', errors);
  await browserRef?.close().catch(() => {});
  process.exit(1);
});
