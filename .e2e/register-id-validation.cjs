/* Browser e2e for roster-gated registration IDs. Run: node .e2e/register-id-validation.cjs
 * (dev server on :3000 must be running; deps were installed --no-save —
 * reinstall with `npm i --no-save playwright @clerk/testing` if swept).
 * Requires the roster import first: npm run import:students.
 *
 * Signs up two throwaway +clerk_test users (OTP 424242) and verifies the
 * (studentId, batch) validation on the /register form:
 *   actor 1 — 1717062 + 2018 (valid; same ID also sits in the 7th batch's
 *             roster) as the page's FIRST submit -> registration succeeds,
 *             proving per-batch (non-global) uniqueness end to end
 *   actor 2 — (i) 1117001 + 2018 (real ID, wrong batch) -> "not valid";
 *             (ii) 9999999 + 2018 (unknown ID)          -> "not valid";
 *             (iii) the now-claimed 1717062 + 2018 as a THIRD submit ->
 *             "already registered in this batch", and no Mongo record is
 *             left behind (also proves resubmitting an errored form works)
 * No file uploads are performed (registration allows none), so there are no
 * Cloudinary assets to clean up. The `students` roster is never modified.
 * Zero page errors expected across both browser contexts. */
const { chromium } = require('playwright');
const { clerkSetup, setupClerkTestingToken } = require('@clerk/testing/playwright');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { v2: cloudinary } = require('cloudinary');

const BASE = 'http://localhost:3000';
const FAPI = 'https://evident-ocelot-8419.clerk.accounts.dev';
const OUT = path.join(__dirname, 'artifacts');
fs.mkdirSync(OUT, { recursive: true });

const PASSWORD = 'TestPass!2026xyz'; // Clerk instance enforces 15+ chars
const STAMP = Date.now();
const EMAIL1 = `rostera${STAMP}+clerk_test@example.com`;
const EMAIL2 = `rosterb${STAMP}+clerk_test@example.com`;
const PHONE = '+8801712345678';
// 1717062 is a real roster ID that exists in BOTH batch 7 ('2017') and
// batch 8 ('2018') — registering it under 2018 proves IDs are per-batch.
const CROSS_BATCH_ID = '1717062';

const log = (...a) => console.log('[reg]', ...a);
let failures = 0;
let browserRef = null;
const errors = [];
const check = (name, ok) => {
  log(ok ? `PASS ${name}` : `FAIL ${name}`);
  if (!ok) failures++;
};

function loadEnvLocal() {
  const raw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

async function cleanup() {
  try {
    if (mongoose.connection.readyState === 1) {
      const users = mongoose.connection.collection('users');
      const actor1 = await users.findOne({ email: EMAIL1 });
      if (actor1) {
        for (const url of [actor1.photo, actor1.doc]) {
          const m = String(url ?? '').match(/\/image\/upload\/(?:[^/]+\/)*v\d+\/(.+)\.[a-z0-9]+$/i);
          if (url && m) await cloudinary.uploader.destroy(m[1]).catch(() => {});
        }
      }
      await users.deleteOne({ email: EMAIL1 });
      await users.deleteOne({ email: EMAIL2 });
      log('cleaned up Mongo records for', EMAIL1, '+', EMAIL2);
    }
  } catch (e) {
    log('cleanup error:', e.message);
  }
  await mongoose.disconnect().catch(() => {});
}

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

/** Fresh browser context wired to its own Clerk dev-browser token (a second
 * context cannot reuse the first one's token — sessions are per dev browser). */
async function makeActor(browser, label) {
  const dbRes = await fetch(`${FAPI}/v1/dev_browser`, { method: 'POST' });
  const devBrowser = await dbRes.json();
  if (!devBrowser.token) throw new Error(`could not create Clerk dev browser for ${label}`);
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();
  await setupClerkTestingToken({ page });
  const dvb = `__clerk_db_jwt=${devBrowser.token}`;
  const goto = (p) =>
    page.goto(BASE + p + (p.includes('?') ? '&' : '?') + dvb, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => {
    const url = r.url();
    if (!/clerk|cloudflare/.test(url))
      log(`REQUEST FAILED ${r.method()} ${url.split('?')[0]} :: ${r.failure()?.errorText ?? '?'}`);
  });
  // Server actions are POSTs to the page URL — counting ours (submitAndExpect
  // ties each assertion to a fresh one) and logging them (plus any 4xx/5xx)
  // shows whether a submit's request actually went out and what came back.
  const posts = { n: 0 };
  page.on('response', (r) => {
    if (!r.url().startsWith(BASE)) return;
    if (r.request().method() === 'POST' && r.url().split('?')[0] === `${BASE}/register`) posts.n++;
    if (r.request().method() === 'POST' || r.status() >= 400)
      log(`RESPONSE ${r.request().method()} ${r.url().split('?')[0]} -> ${r.status()}`);
  });
  return { context, page, goto, posts };
}

/** Clerk sign-up (email + password + name, OTP 424242) landing on /register. */
async function signUpActor(page, goto, email, first, last) {
  const emailField = 'input[name="identifier"], input[name="emailAddress"]';
  await goto('/sign-up');
  await waitFor(() => page.locator(emailField).count());
  if (await page.locator('input[name="firstName"]').count())
    await page.locator('input[name="firstName"]').fill(first);
  if (await page.locator('input[name="lastName"]').count())
    await page.locator('input[name="lastName"]').fill(last);
  await page.locator(emailField).first().fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await primaryContinue(page);
  const codeSel = 'input[name="code"], input[autocomplete="one-time-code"]';
  if (await waitFor(() => page.locator(codeSel).count(), 8000)) {
    // Let the OTP widget finish hydrating before touching it — a fill() that
    // lands mid-hydration gets wiped by the re-render (real flake we hit).
    await page.waitForTimeout(1500);
    await page.locator(codeSel).first().click({ timeout: 5000 }).catch(() => {});
    await page.keyboard.type('424242', { delay: 60 });
    // A complete code usually auto-submits — only click Continue if we're
    // still on the verify step, and only an ENABLED primary button.
    if (!(await waitFor(() => page.url().includes('/register'), 8000))) {
      const cont = page.locator('button.cl-formButtonPrimary:not([disabled])').first();
      if (await waitFor(() => cont.count(), 5000)) {
        await cont.click({ timeout: 10000 }).catch(() => {});
      }
    }
  }
  try {
    await page.waitForURL('**/register', { timeout: 45000 });
  } catch {
    log('stuck at:', page.url());
    await page.screenshot({ path: path.join(OUT, 'reg-stuck.png') });
    throw new Error(`sign-up for ${email} never reached /register`);
  }
  await page.waitForTimeout(1500);
}

/** Dump the live form state on a miss — body.textContent is useless here (the
 * inline theme script is its first text), but every alert (field errors AND the
 * form-level message banner render role="alert"), the controls, the button
 * (pending state renames it), and the URL tell the real story. */
async function dumpMiss(page, why) {
  const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
  const idVal = await page.locator('#studentId').inputValue().catch(() => '?');
  const batchSel = await page
    .locator('#batch')
    .evaluate((el) => (el.selectedOptions[0] ? el.selectedOptions[0].textContent : '?'))
    .catch(() => '?');
  const btn = await page
    .getByRole('button', { name: /Complete registration|Saving your profile/i })
    .first()
    .textContent()
    .catch(() => '?');
  log(`miss (${why}): url=${page.url().split('?')[0]}`);
  log(`miss: studentId="${idVal}" batch="${batchSel}" button="${String(btn).trim()}"`);
  log(`miss: alerts=${JSON.stringify(alerts)}`);
}

/** Submit the form and assert on the text rendered by THIS submit's response.
 * The negative cases share an identical error string, so matching text alone
 * can hit the PREVIOUS error before this action's response even arrives — a
 * real race we hit: filling while the prior response was in flight let React's
 * auto form-reset snap the batch select back, and the click submitted the
 * default batch. So: never start while an action is pending, and tie the
 * assertion to a fresh POST /register (counted in makeActor). */
async function submitAndExpect(actor, studentId, batch, text, timeout = 30000) {
  const { page, posts } = actor;
  await waitFor(() => page.getByRole('button', { name: /Complete registration/i }).count(), timeout);
  await page.locator('#studentId').fill(studentId);
  await page.locator('#batch').selectOption(batch);
  const before = posts.n;
  await page.getByRole('button', { name: /Complete registration/i }).click();
  if (!(await waitFor(() => posts.n > before, timeout))) {
    await dumpMiss(page, 'no action response arrived');
    return false;
  }
  const hit = await waitFor(() => page.getByText(text).count(), 10000);
  if (!hit) await dumpMiss(page, 'response arrived, expected text missing');
  return hit;
}

async function main() {
  loadEnvLocal();
  const cm = (process.env.CLOUDINARY_URL ?? '').match(
    /^cloudinary:\/\/([^:@]+):([^@]+)@([^@/?]+)\s*$/
  );
  if (!cm) throw new Error('CLOUDINARY_URL missing/malformed in .env.local');
  cloudinary.config({ api_key: cm[1], api_secret: cm[2], cloud_name: cm[3], secure: true });
  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.collection('users');
  const students = mongoose.connection.collection('students');

  // Preconditions: roster imported, and the compound (not global) index in force.
  check('precondition: roster has 1717062 under 2018', !!(await students.findOne({ studentId: CROSS_BATCH_ID, batch: '2018' })));
  check('precondition: roster has 1717062 under 2017', !!(await students.findOne({ studentId: CROSS_BATCH_ID, batch: '2017' })));
  // Self-heal a crashed prior run (only ever touches +clerk_test artifacts).
  const stale = await users.deleteMany({ studentId: CROSS_BATCH_ID, batch: '2018', email: /clerk_test/ });
  if (stale.deletedCount) log(`removed ${stale.deletedCount} stale test user(s) from a crashed run`);

  await clerkSetup();
  const browser = browserRef = await chromium.launch({
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const shot = (n, page) => page.screenshot({ path: path.join(OUT, `${n}.png`), fullPage: false });

  // --- Actor 1: valid cross-batch ID as the page's FIRST submit ---
  // (First runs failed only when the valid pair was the THIRD submit of an
  // already-errored form, so the valid case now goes first.)
  const a1 = await makeActor(browser, 'actor 1');
  await signUpActor(a1.page, a1.goto, EMAIL1, 'Ida', 'Checkley');
  await a1.page.locator('#phone').fill(PHONE);

  check('actor1: valid roster ID (also in another batch) accepted', await submitAndExpect(
    a1, CROSS_BATCH_ID, '2018', 'Welcome aboard', 60000
  ));
  await shot('reg-success', a1.page);

  const doc1 = await users.findOne({ email: EMAIL1 });
  check('actor1: Mongo record has 1717062 / 2018', doc1?.studentId === CROSS_BATCH_ID && doc1?.batch === '2018');
  check('actor1: record pending verification', doc1?.verificationStatus === 'pending');

  // --- Actor 2: invalid -> invalid -> the now-claimed pair (3rd submit) ---
  const a2 = await makeActor(browser, 'actor 2');
  await signUpActor(a2.page, a2.goto, EMAIL2, 'Ora', 'Duplee');
  await a2.page.locator('#phone').fill(PHONE);
  check('actor2: real ID in the wrong batch rejected', await submitAndExpect(
    a2, '1117001', '2018', 'This Student ID is not valid for the selected batch.'
  ));
  await shot('reg-invalid-batch', a2.page);
  check('actor2: unknown ID rejected', await submitAndExpect(
    a2, '9999999', '2018', 'This Student ID is not valid for the selected batch.'
  ));
  await shot('reg-invalid-unknown', a2.page);
  // React auto-resets <form action> fields when an action response lands; a
  // controlled select must keep its chosen value through that. If this ever
  // fails, users resubmitting after an error would silently send batch '2011'.
  check('actor2: form keeps the selected batch after an error', await (async () => {
    await waitFor(() => a2.page.getByRole('button', { name: /Complete registration/i }).count(), 30000);
    return (await a2.page.locator('#batch').inputValue().catch(() => null)) === '2018';
  })());
  check('actor2: claimed ID -> already registered in this batch', await submitAndExpect(
    a2, CROSS_BATCH_ID, '2018', 'An account with this Student ID is already registered in this batch.', 60000
  ));
  await shot('reg-already', a2.page);
  check('actor2: rejected submit left no Mongo record', !(await users.findOne({ email: EMAIL2 })));

  log('page errors seen:', errors.length ? errors : 'none');
  check('zero page errors', errors.length === 0);
  await browser.close();
  await cleanup();
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exitCode = failures ? 1 : 0;
}

main().catch(async (e) => {
  console.error('[reg] fatal:', e);
  if (errors.length) console.error('[reg] page errors:', errors);
  await browserRef?.close().catch(() => {});
  await cleanup();
  process.exit(1);
});
