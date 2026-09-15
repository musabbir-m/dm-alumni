/* Browser e2e for the /admin dashboard. Run: node .e2e/admin-visual.cjs
 * (dev server on :3000 must be running; deps were installed --no-save —
 * reinstall with `npm i --no-save playwright @clerk/testing` if swept).
 * Signs up a throwaway +clerk_test user (OTP 424242), completes registration,
 * flips the Mongo record to admin (role + verified), pre-creates a plain
 * target user, then verifies in the browser:
 *   - /profile shows the Admin tools card and links to /admin
 *   - /admin lists rows; search by name, batch filter, status filter, reset
 *   - promote / approve / reject through the real UI update Mongo
 *   - the admin's own row has no action buttons; zero page errors
 * Cleans up both Mongo records + the actor's Cloudinary assets afterwards
 * (the Clerk dev user stays, same as the other e2e users pending cleanup). */
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

const EMAIL = `adminvis${Date.now()}+clerk_test@example.com`;
const PASSWORD = 'TestPass!2026xyz'; // Clerk instance enforces 15+ chars
const STUDENT_ID = `ADV-${Date.now() % 100000}`;
const ACTOR_NAME = 'Ada Minvis';
// Distinctive enough that a name search matches exactly one member
const TARGET = {
  name: 'Zephyr Quillstone',
  email: `target${Date.now()}+tmp@dm-alumni.local`,
  phone: '+8801799888777',
  studentId: `ADVT-${Date.now() % 100000}`,
  batch: '2018',
};

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 72 720 Td (E2E test) Tj ET\nendstream endobj\ntrailer<</Size 5/Root 1 0 R>>\n%%EOF',
  'utf8'
);

const log = (...a) => console.log('[adm]', ...a);
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

// Extract a destroyable public_id from a delivered URL (mirrors
// cloudinaryAssetFromUrl): drops transformation + version segments.
function publicIdFromUrl(url) {
  const m = String(url).match(/\/image\/upload\/(.+)$/);
  if (!m) return null;
  const parts = m[1].split('/');
  while (
    parts.length &&
    (/^[a-z]+_[a-z0-9]+(,[a-z]+_[a-z0-9]+)*$/i.test(parts[0]) || /^v\d+$/.test(parts[0]))
  ) {
    parts.shift();
  }
  const last = parts.pop();
  if (!last) return null;
  return [...parts, last.replace(/\.[a-z0-9]+$/i, '')].join('/');
}

async function cleanup() {
  try {
    if (mongoose.connection.readyState === 1) {
      const users = mongoose.connection.collection('users');
      const actor = await users.findOne({ email: EMAIL });
      if (actor) {
        for (const url of [actor.photo, actor.doc]) {
          const pid = publicIdFromUrl(url);
          if (pid) await cloudinary.uploader.destroy(pid).catch(() => {});
        }
      }
      await users.deleteOne({ email: EMAIL });
      await users.deleteOne({ email: TARGET.email });
      log('cleaned up Mongo records + Cloudinary assets for', EMAIL, 'and', TARGET.email);
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

async function main() {
  loadEnvLocal();
  const cm = (process.env.CLOUDINARY_URL ?? '').match(
    /^cloudinary:\/\/([^:@]+):([^@]+)@([^@/?]+)\s*$/
  );
  if (!cm) throw new Error('CLOUDINARY_URL missing/malformed in .env.local');
  cloudinary.config({ api_key: cm[1], api_secret: cm[2], cloud_name: cm[3], secure: true });
  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.collection('users');

  await clerkSetup();
  // Dev-browser token via URL param — see .e2e/e2e.cjs for the full rationale
  const dbRes = await fetch(`${FAPI}/v1/dev_browser`, { method: 'POST' });
  const devBrowser = await dbRes.json();
  if (!devBrowser.token) throw new Error('could not create Clerk dev browser');
  const DVB = `__clerk_db_jwt=${devBrowser.token}`;
  const browser = browserRef = await chromium.launch({
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();
  await setupClerkTestingToken({ page });
  const goto = (p) =>
    page.goto(BASE + p + (p.includes('?') ? '&' : '?') + DVB, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => {
    const url = r.url();
    if (!/clerk|cloudflare/.test(url)) log(`REQUEST FAILED ${r.method()} ${url.split('?')[0]}`);
  });
  const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`), fullPage: false });

  const targetRow = () => page.locator('li', { hasText: TARGET.name });
  const actorRow = () => page.locator('li', { hasText: ACTOR_NAME });

  // --- Sign-up + complete registration (same dance as e2e.cjs) ---
  const emailField = 'input[name="identifier"], input[name="emailAddress"]';
  await goto('/sign-up');
  await waitFor(() => page.locator(emailField).count());
  if (await page.locator('input[name="firstName"]').count())
    await page.locator('input[name="firstName"]').fill('Ada');
  if (await page.locator('input[name="lastName"]').count())
    await page.locator('input[name="lastName"]').fill('Minvis');
  await page.locator(emailField).first().fill(EMAIL);
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
    // still on the verify step, and only an ENABLED primary button (the
    // disabled/loading one just blocks the click for its whole timeout).
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
    await shot('adm-stuck');
    const stuckBody = await page.textContent('body').catch(() => '');
    log('body snippet:', stuckBody.slice(0, 200).replace(/\s+/g, ' '));
    throw new Error('never reached /register');
  }
  await page.waitForTimeout(1500);
  await page.locator('#phone').fill('+8801712345678');
  await page.locator('#studentId').fill(STUDENT_ID);
  await page.locator('#batch').selectOption('2019');
  await page.setInputFiles('#photo', { name: 'photo.png', mimeType: 'image/png', buffer: PNG });
  await page.setInputFiles('#document', { name: 'doc.pdf', mimeType: 'application/pdf', buffer: PDF });
  await page.getByRole('button', { name: /Complete registration/i }).click();
  await page.waitForSelector('text=Welcome aboard', { timeout: 60000 });
  await page.getByRole('link', { name: /Go to your profile/i }).click();
  await page.waitForURL('**/profile');
  await page.waitForTimeout(1500);

  // --- Promote the actor to admin in Mongo + create the target member ---
  await users.updateOne(
    { email: EMAIL },
    { $set: { role: 'admin', verificationStatus: 'verified' } }
  );
  await users.insertOne({
    name: TARGET.name,
    email: TARGET.email,
    phone: TARGET.phone,
    studentId: TARGET.studentId,
    batch: TARGET.batch,
    role: 'alumni',
    verificationStatus: 'pending',
    moderatorBatch: null,
    photo: null,
    docType: null,
    doc: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  log('actor is admin; target created');

  // --- /profile shows the admin card ---
  await goto('/profile');
  await page.waitForTimeout(1200);
  let body = await page.textContent('main');
  check('/profile: Admin tools card', body.includes('Admin tools'));
  await page.getByRole('link', { name: /Open dashboard/i }).click();
  await page.waitForURL('**/admin');
  await page.waitForTimeout(1200);
  await shot('adm-admin');
  body = await page.textContent('main');
  check('/admin: heading', body.includes('Member management'));
  check('/admin: target row listed', (await targetRow().count()) === 1);
  check('/admin: own row listed with (you)', (await actorRow().count()) === 1);
  check('/admin: search input present', (await page.locator('input[name="q"]').count()) === 1);
  check('/admin: batch select present', (await page.locator('select[name="batch"]').count()) === 1);
  check('/admin: status select present', (await page.locator('select[name="status"]').count()) === 1);

  // --- Search by name narrows to the target ---
  await page.locator('input[name="q"]').fill(TARGET.name);
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.waitForTimeout(1000);
  await shot('adm-search');
  check('search: target still visible', (await targetRow().count()) === 1);
  check('search: actor row filtered out', (await actorRow().count()) === 0);
  body = await page.textContent('main');
  check('search: "Showing 1 of" counter', body.includes('Showing 1 of'));

  // --- Reset restores the full list ---
  await page.getByRole('link', { name: 'Reset' }).click();
  check(
    'reset: actor row back',
    await waitFor(() => actorRow().count().then((n) => n === 1))
  );

  // --- Batch filter ---
  await page.locator('select[name="batch"]').selectOption(TARGET.batch);
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.waitForTimeout(1000);
  check('batch filter: target visible', (await targetRow().count()) === 1);
  await page.getByRole('link', { name: 'Reset' }).click();
  await page.waitForTimeout(1000);

  // --- Status filter ---
  await page.locator('select[name="status"]').selectOption('pending');
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.waitForTimeout(1000);
  await shot('adm-status-pending');
  check('status filter: pending target visible', (await targetRow().count()) === 1);
  await page.getByRole('link', { name: 'Reset' }).click();
  await page.waitForTimeout(1000);

  // --- Promote through the UI ---
  await targetRow().getByRole('button', { name: 'Promote to Moderator' }).click();
  const flipped = await waitFor(() =>
    targetRow().getByRole('button', { name: 'Demote to Alumni' }).count()
  );
  check('promote: button flipped to Demote', flipped);
  let t = await users.findOne({ email: TARGET.email });
  check('promote: Mongo role moderator', t.role === 'moderator');
  check('promote: Mongo moderatorBatch 2018', t.moderatorBatch === TARGET.batch);
  await shot('adm-promoted');

  // --- Approve through the UI ---
  await targetRow().getByRole('button', { name: 'Approve', exact: true }).click();
  const approved = await waitFor(() =>
    targetRow().getByText('Verified', { exact: true }).count()
  );
  check('approve: Verified badge shown', approved);
  t = await users.findOne({ email: TARGET.email });
  check('approve: Mongo verified', t.verificationStatus === 'verified');

  // --- Reject path: reset the target, then reject through the UI ---
  await users.updateOne(
    { email: TARGET.email },
    { $set: { role: 'alumni', verificationStatus: 'pending', moderatorBatch: null } }
  );
  await goto('/admin');
  await page.waitForTimeout(1200);
  await targetRow().getByRole('button', { name: 'Reject', exact: true }).click();
  const rejected = await waitFor(() =>
    targetRow().getByText('Verification rejected', { exact: true }).count()
  );
  check('reject: rejection badge shown', rejected);
  t = await users.findOne({ email: TARGET.email });
  check('reject: Mongo rejected', t.verificationStatus === 'rejected');
  await shot('adm-rejected');

  // --- Own row carries no action buttons ---
  check('own row: no Promote button', (await actorRow().getByRole('button', { name: 'Promote to Moderator' }).count()) === 0);
  check('own row: no Approve button', (await actorRow().getByRole('button', { name: 'Approve', exact: true }).count()) === 0);

  log('page errors seen:', errors.length ? errors : 'none');
  check('zero page errors', errors.length === 0);
  await browser.close();
  await cleanup();
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exitCode = failures ? 1 : 0;
}

main().catch(async (e) => {
  console.error('[adm] fatal:', e);
  if (errors.length) console.error('[adm] page errors:', errors);
  await browserRef?.close().catch(() => {});
  await cleanup();
  process.exit(1);
});
