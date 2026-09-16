/* Browser e2e for the moderator view of the /admin dashboard.
 * Run: node .e2e/moderate-visual.cjs (dev server on :3000 must be running;
 * deps were installed --no-save — reinstall with `npm i --no-save playwright
 * @clerk/testing` if swept).
 * Signs up a throwaway +clerk_test user (OTP 424242), completes registration
 * (batch 2018), flips the Mongo record to moderator (moderatorBatch 2018),
 * pre-creates a same-batch and an other-batch target, then verifies:
 *   - /profile shows the "Moderator tools" card (and no admin card)
 *   - /admin lists ALL users — moderators see everyone
 *   - same-batch rows: Approve/Reject, NO promote/demote button
 *   - other-batch rows: no buttons, "Outside your batch" note
 *   - approve / reject through the real UI update Mongo
 *   - the moderator's own row has no action buttons; zero page errors
 * Cleans up all three Mongo records + the actor's Cloudinary assets
 * afterwards (the Clerk dev user stays, same as the other e2e users). */
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

const EMAIL = `modvis${Date.now()}+clerk_test@example.com`;
const PASSWORD = 'TestPass!2026xyz'; // Clerk instance enforces 15+ chars
const STUDENT_ID = `MDV-${Date.now() % 100000}`;
const ACTOR_NAME = 'Mona Dervish';
// Distinctive enough that name searches / row locators match exactly one member
const SAME = {
  name: 'Orin Fairweather',
  email: `same${Date.now()}+tmp@dm-alumni.local`,
  phone: '+8801799888001',
  studentId: `MDVS-${Date.now() % 100000}`,
  batch: '2018',
};
const OTHER = {
  name: 'Petra Solvano',
  email: `other${Date.now()}+tmp@dm-alumni.local`,
  phone: '+8801799888002',
  studentId: `MDVO-${Date.now() % 100000}`,
  batch: '2019',
};

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 72 720 Td (E2E test) Tj ET\nendstream endobj\ntrailer<</Size 5/Root 1 0 R>>\n%%EOF',
  'utf8'
);

const log = (...a) => console.log('[mod]', ...a);
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
      await users.deleteOne({ email: SAME.email });
      await users.deleteOne({ email: OTHER.email });
      log('cleaned up Mongo records + Cloudinary assets for', EMAIL, SAME.email, OTHER.email);
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

  const sameRow = () => page.locator('li', { hasText: SAME.name });
  const otherRow = () => page.locator('li', { hasText: OTHER.name });
  const actorRow = () => page.locator('li', { hasText: ACTOR_NAME });

  // --- Sign-up + complete registration (same dance as e2e.cjs) ---
  const emailField = 'input[name="identifier"], input[name="emailAddress"]';
  await goto('/sign-up');
  await waitFor(() => page.locator(emailField).count());
  if (await page.locator('input[name="firstName"]').count())
    await page.locator('input[name="firstName"]').fill('Mona');
  if (await page.locator('input[name="lastName"]').count())
    await page.locator('input[name="lastName"]').fill('Dervish');
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
    await shot('mod-stuck');
    const stuckBody = await page.textContent('body').catch(() => '');
    log('body snippet:', stuckBody.slice(0, 200).replace(/\s+/g, ' '));
    throw new Error('never reached /register');
  }
  await page.waitForTimeout(1500);
  await page.locator('#phone').fill('+8801712345699');
  await page.locator('#studentId').fill(STUDENT_ID);
  await page.locator('#batch').selectOption('2018');
  await page.setInputFiles('#photo', { name: 'photo.png', mimeType: 'image/png', buffer: PNG });
  await page.setInputFiles('#document', { name: 'doc.pdf', mimeType: 'application/pdf', buffer: PDF });
  await page.getByRole('button', { name: /Complete registration/i }).click();
  await page.waitForSelector('text=Welcome aboard', { timeout: 60000 });
  await page.getByRole('link', { name: /Go to your profile/i }).click();
  await page.waitForURL('**/profile');
  await page.waitForTimeout(1500);

  // --- Promote the actor to batch moderator in Mongo + create targets ---
  await users.updateOne(
    { email: EMAIL },
    { $set: { role: 'moderator', moderatorBatch: '2018', verificationStatus: 'verified' } }
  );
  for (const t of [SAME, OTHER]) {
    await users.insertOne({
      name: t.name,
      email: t.email,
      phone: t.phone,
      studentId: t.studentId,
      batch: t.batch,
      role: 'alumni',
      verificationStatus: 'pending',
      moderatorBatch: null,
      photo: null,
      docType: null,
      doc: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  log('actor is moderator of 2018; targets created');

  // --- /profile shows the moderator card (and not the admin one) ---
  await goto('/profile');
  await page.waitForTimeout(1200);
  let body = await page.textContent('main');
  check('/profile: Moderator tools card', body.includes('Moderator tools'));
  check('/profile: no Admin tools card', !body.includes('Admin tools'));
  await page.getByRole('link', { name: /Open dashboard/i }).click();
  await page.waitForURL('**/admin');
  await page.waitForTimeout(1200);
  await shot('mod-admin');

  // --- Moderators see ALL users, exactly like the admin dashboard ---
  body = await page.textContent('main');
  check('/admin: heading', body.includes('Member management'));
  check('/admin: scoped subtitle mentions own batch', body.includes('you decide verification for'));
  check('/admin: same-batch target listed', (await sameRow().count()) === 1);
  check('/admin: other-batch target listed', (await otherRow().count()) === 1);
  check('/admin: own row listed with (you)', (await actorRow().count()) === 1);
  check('/admin: filters present', (await page.locator('input[name="q"]').count()) === 1
    && (await page.locator('select[name="batch"]').count()) === 1
    && (await page.locator('select[name="status"]').count()) === 1);

  // --- Same-batch row: verification controls only, no role toggle ---
  check('same batch: Approve present', (await sameRow().getByRole('button', { name: 'Approve', exact: true }).count()) === 1);
  check('same batch: Reject present', (await sameRow().getByRole('button', { name: 'Reject', exact: true }).count()) === 1);
  check('same batch: no Promote button', (await sameRow().getByRole('button', { name: 'Promote to Moderator' }).count()) === 0);
  check('same batch: no Demote button', (await sameRow().getByRole('button', { name: 'Demote to Alumni' }).count()) === 0);

  // --- Other-batch row: read-only with the scoped note ---
  check('other batch: no Approve button', (await otherRow().getByRole('button', { name: 'Approve', exact: true }).count()) === 0);
  check('other batch: no Reject button', (await otherRow().getByRole('button', { name: 'Reject', exact: true }).count()) === 0);
  check('other batch: "Outside your batch" note', (await otherRow().getByText('Outside your batch').count()) === 1);

  // --- Approve the same-batch member through the UI ---
  await sameRow().getByRole('button', { name: 'Approve', exact: true }).click();
  const approved = await waitFor(() => sameRow().getByText('Verified', { exact: true }).count());
  check('approve: Verified badge shown', approved);
  let t = await users.findOne({ email: SAME.email });
  check('approve: Mongo verified', t.verificationStatus === 'verified');
  await shot('mod-approved');

  // --- Reject path: reset the target, then reject through the UI ---
  await users.updateOne(
    { email: SAME.email },
    { $set: { verificationStatus: 'pending' } }
  );
  await goto('/admin');
  await page.waitForTimeout(1200);
  await sameRow().getByRole('button', { name: 'Reject', exact: true }).click();
  const rejected = await waitFor(() =>
    sameRow().getByText('Verification rejected', { exact: true }).count()
  );
  check('reject: rejection badge shown', rejected);
  t = await users.findOne({ email: SAME.email });
  check('reject: Mongo rejected', t.verificationStatus === 'rejected');
  await shot('mod-rejected');

  // --- Own row carries no action buttons ---
  check('own row: no Approve button', (await actorRow().getByRole('button', { name: 'Approve', exact: true }).count()) === 0);
  check('own row: no Promote button', (await actorRow().getByRole('button', { name: 'Promote to Moderator' }).count()) === 0);

  log('page errors seen:', errors.length ? errors : 'none');
  check('zero page errors', errors.length === 0);
  await browser.close();
  await cleanup();
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exitCode = failures ? 1 : 0;
}

main().catch(async (e) => {
  console.error('[mod] fatal:', e);
  if (errors.length) console.error('[mod] page errors:', errors);
  await browserRef?.close().catch(() => {});
  await cleanup();
  process.exit(1);
});
