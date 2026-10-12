/* Throwaway probe for the homepage's embedded Clerk <SignUp> (hash routing):
 * (a) the footer "Sign in" link navigates to /sign-in
 * (b) a full sign-up through the embedded card (email + password, OTP 424242)
 *     still completes and lands on /register (sign-up fallback redirect)
 * Run: node .e2e/probe-connect-link.cjs  (dev server on :3000) */
const { chromium } = require('playwright');
const { clerkSetup, setupClerkTestingToken } = require('@clerk/testing/playwright');
const fs = require('fs');

function loadEnvLocal() {
  const raw = fs.readFileSync(`${process.cwd()}/.env.local`, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const BASE = 'http://localhost:3000';
const FAPI = 'https://evident-ocelot-8419.clerk.accounts.dev';
const PASSWORD = 'TestPass!2026xyz';
const EMAIL = `embed${Date.now()}+clerk_test@example.com`;

async function waitFor(fn, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function primaryContinue(page) {
  const btn = page.locator('button.cl-formButtonPrimary').first();
  if (await btn.count()) return btn.click();
  return page.getByRole('button', { name: 'Continue', exact: true }).first().click();
}

(async () => {
  loadEnvLocal();
  await clerkSetup();
  const dbRes = await fetch(`${FAPI}/v1/dev_browser`, { method: 'POST' });
  const devBrowser = await dbRes.json();
  if (!devBrowser.token) throw new Error('could not create Clerk dev browser');

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();
  await setupClerkTestingToken({ page });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 120)));

  // --- (a) Sign in footer link ------------------------------------------
  await page.goto(`${BASE}/?__clerk_db_jwt=${devBrowser.token}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.locator('#connect .cl-card').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(2000);
  const link = page.locator('#connect a', { hasText: /^sign in$/i }).first();
  await link.click({ timeout: 10000 });
  await page.waitForURL('**/sign-in', { timeout: 15000 });
  const linkOk = new URL(page.url()).pathname === '/sign-in';
  console.log(linkOk ? 'PASS Sign in link -> /sign-in' : `FAIL Sign in link landed at ${page.url()}`);

  // --- (b) full embedded sign-up ----------------------------------------
  await page.goto(`${BASE}/?__clerk_db_jwt=${devBrowser.token}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  const emailField = 'input[name="identifier"], input[name="emailAddress"]';
  await waitFor(() => page.locator(emailField).count());
  if (await page.locator('input[name="firstName"]').count())
    await page.locator('input[name="firstName"]').fill('Embed');
  if (await page.locator('input[name="lastName"]').count())
    await page.locator('input[name="lastName"]').fill('Probe');
  await page.locator(emailField).first().fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await primaryContinue(page);
  const codeSel = 'input[name="code"], input[autocomplete="one-time-code"]';
  if (await waitFor(() => page.locator(codeSel).count(), 10000)) {
    await page.waitForTimeout(1500); // let the OTP widget finish hydrating
    await page.locator(codeSel).first().click({ timeout: 5000 }).catch(() => {});
    await page.keyboard.type('424242', { delay: 60 });
    if (!(await waitFor(() => page.url().includes('/register'), 8000))) {
      const cont = page.locator('button.cl-formButtonPrimary:not([disabled])').first();
      if (await waitFor(() => cont.count(), 5000)) {
        await cont.click({ timeout: 10000 }).catch(() => {});
      }
    }
  }
  let flowOk = true;
  try {
    await page.waitForURL('**/register', { timeout: 45000 });
  } catch {
    flowOk = false;
  }
  if (flowOk) {
    const formUp = await waitFor(() => page.locator('#studentId').count(), 20000);
    console.log(`PASS embedded sign-up completed -> ${new URL(page.url()).pathname} (step-2 form ${formUp ? 'mounted' : 'NOT mounted'})`);
  } else {
    console.log(`FAIL embedded sign-up did not reach /register; stuck at ${page.url()}`);
    await page.screenshot({ path: '.e2e/artifacts/probe-connect-flow.png', fullPage: false });
  }
  console.log('page errors:', pageErrors.length ? pageErrors : 'none');
  await browser.close();
})().catch((e) => {
  console.error('probe fatal:', e.message);
  process.exit(1);
});
