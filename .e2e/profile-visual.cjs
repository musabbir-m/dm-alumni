/* Visual + interaction check for the verified-account document lock.
 * Run: node .e2e/profile-visual.cjs (dev server on :3000 must be running).
 * Signs up a throwaway +clerk_test user (OTP 424242), completes registration,
 * then verifies in the browser:
 *   - /profile + /profile/edit as PENDING — files section, doc editable
 *   - flips the Mongo record to verified, revisits both — doc locked, no file input
 *   - locked edit page still accepts a photo replace end-to-end (name + photo
 *     change, doc URL and verified status untouched)
 * Cleans up its Mongo record + Cloudinary assets afterwards (the Clerk dev
 * user stays, same as the other e2e users pending a cleanup decision). */
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

const EMAIL = `visual${Date.now()}+clerk_test@example.com`;
const PASSWORD = 'TestPass!2026xyz'; // Clerk instance enforces 15+ chars
const STUDENT_ID = `VIS-${Date.now() % 100000}`;

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 72 720 Td (E2E test) Tj ET\nendstream endobj\ntrailer<</Size 5/Root 1 0 R>>\n%%EOF',
  'utf8'
);

const log = (...a) => console.log('[vis]', ...a);
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
      const u = await users.findOne({ email: EMAIL });
      if (u) {
        for (const url of [u.photo, u.doc]) {
          const pid = publicIdFromUrl(url);
          if (pid) await cloudinary.uploader.destroy(pid).catch(() => {});
        }
        await users.deleteOne({ email: EMAIL });
        log('cleaned up Mongo record + Cloudinary assets for', EMAIL);
      }
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

  // --- Sign-up + complete registration (same dance as e2e.cjs) ---
  const emailField = 'input[name="identifier"], input[name="emailAddress"]';
  await goto('/sign-up');
  await waitFor(() => page.locator(emailField).count());
  if (await page.locator('input[name="firstName"]').count())
    await page.locator('input[name="firstName"]').fill('Visual');
  if (await page.locator('input[name="lastName"]').count())
    await page.locator('input[name="lastName"]').fill('Check');
  await page.locator(emailField).first().fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await primaryContinue(page);
  const codeSel = 'input[name="code"], input[autocomplete="one-time-code"]';
  if (await waitFor(() => page.locator(codeSel).count(), 8000)) {
    await page.locator(codeSel).first().fill('424242');
    await primaryContinue(page).catch(() => {});
  }
  await page.waitForURL('**/register', { timeout: 30000 });
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

  // --- Pending variant ---
  await shot('vis-profile-pending');
  let body = await page.textContent('main');
  check('pending /profile: files section', body.includes('Your uploaded files'));
  check('pending /profile: photo card "Always editable"', body.includes('Always editable'));
  check('pending /profile: doc "Editable until verification"', body.includes('Editable until verification'));
  check('pending /profile: doc type label', body.includes('Graduation certificate'));
  check('pending /profile: no lock note', !body.includes('Locked — account verified'));

  await goto('/profile/edit');
  await page.waitForTimeout(1200);
  await shot('vis-edit-pending');
  check('pending /profile/edit: doc file input present', (await page.locator('#document').count()) === 1);
  check(
    'pending /profile/edit: type toggles present',
    (await page.getByRole('button', { name: /Graduation Certificate/i }).count()) === 1
  );

  // --- Flip to verified in Mongo, revisit both pages ---
  await users.updateOne({ email: EMAIL }, { $set: { verificationStatus: 'verified' } });
  const before = await users.findOne({ email: EMAIL });
  log('flipped to verified; photo/doc recorded');

  await goto('/profile');
  await page.waitForTimeout(1200);
  await shot('vis-profile-verified');
  body = await page.textContent('main');
  check('verified /profile: Verified badge', body.includes('Verified'));
  check('verified /profile: doc "Locked — account verified"', body.includes('Locked — account verified'));
  check('verified /profile: photo card still "Always editable"', body.includes('Always editable'));

  await goto('/profile/edit');
  await page.waitForTimeout(1200);
  await shot('vis-edit-verified');
  check('verified /profile/edit: NO doc file input', (await page.locator('#document').count()) === 0);
  check(
    'verified /profile/edit: lock copy shown',
    (await page.getByText('Locked because your account is verified', { exact: false }).count()) > 0
  );
  check('verified /profile/edit: photo input still present', (await page.locator('#photo').count()) === 1);

  // --- Locked page still saves: name + photo change, doc + status must not ---
  await page.locator('#name').fill('Visual Renamed');
  await page.setInputFiles('#photo', { name: 'photo2.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: /Save changes/i }).click();
  await page.waitForSelector('text=Profile updated successfully', { timeout: 60000 });
  await shot('vis-edit-verified-saved');
  await page.waitForTimeout(1000); // let router.refresh() land
  const after = await users.findOne({ email: EMAIL });
  check('locked save: name updated', after.name === 'Visual Renamed');
  check('locked save: photo replaced', after.photo !== before.photo && String(after.photo).includes('res.cloudinary.com'));
  check('locked save: doc URL unchanged', after.doc === before.doc);
  check('locked save: still verified', after.verificationStatus === 'verified');

  log('page errors seen:', errors.length ? errors : 'none');
  await browser.close();
  await cleanup();
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exitCode = failures ? 1 : 0;
}

main().catch(async (e) => {
  console.error('[vis] fatal:', e);
  if (errors.length) console.error('[vis] page errors:', errors);
  await browserRef?.close().catch(() => {});
  await cleanup();
  process.exit(1);
});
