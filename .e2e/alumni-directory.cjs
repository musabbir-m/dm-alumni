/* Browser e2e for the batch directory feature. Run: node .e2e/alumni-directory.cjs
 * (dev server on :3000 must be running; deps were installed --no-save —
 * reinstall with `npm i --no-save playwright @clerk/testing` if swept).
 * Signs up a throwaway +clerk_test user (OTP 424242) into batch 2018 — filling
 * the new #profession + #linkedinUrl fields — completes registration, flips
 * the Mongo record to verified, and inserts temp members (2 verified + 1
 * pending). Then verifies in the browser:
 *   - homepage 2018 batch card shows the DB-backed verified count, links to
 *     /alumni/2018, and the click navigates there
 *   - directory lists every verified member (actor's card marked "(you)"),
 *     hides the pending member, renders photo vs initials fallback, email,
 *     phone, profession, and the LinkedIn icon-link only when set
 *   - search narrows by name ("Showing 1 of N"), gibberish hits the no-match
 *     state, Clear search restores the list
 *   - /alumni/9999 404s; signing out redirects /alumni/2018 → /sign-in
 *   - /profile shows the Profession + LinkedIn rows; /profile/edit carries
 *     both values; a non-LinkedIn URL fails validation, corrected save works
 *   - zero page errors
 * Cleans up the temp Mongo records + the actor's Cloudinary assets afterwards
 * (the Clerk dev user stays, same as the other e2e users pending cleanup).
 *
 * NOTE: run against a dev server started AFTER the profession/linkedinUrl
 * schema change. A long-lived `next dev` keeps the Mongoose model registered
 * with the pre-change schema (the `mongoose.models.User ??` guard defeats
 * HMR re-registration) and strict mode then silently drops the new fields on
 * every write through that process — the persistence checks below fail while
 * the code itself is fine (verified via a fresh-process tsx run). */
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

const EMAIL = `alumnidir${Date.now()}+clerk_test@example.com`;
const PASSWORD = 'TestPass!2026xyz'; // Clerk instance enforces 15+ chars
const STUDENT_ID = `ALD-${Date.now() % 100000}`;
const ACTOR = {
  name: 'Ivy Rectory', // Clerk joins firstName/lastName at sign-up
  profession: 'Research Associate at C3ER',
  linkedinUrl: 'https://www.linkedin.com/in/ivy-rectory',
};
// Verified temp with the full card payload (profession + LinkedIn)
const TEMP_RICH = {
  name: 'Marisol Quillen',
  email: `temprich${Date.now()}+tmp@dm-alumni.local`,
  phone: '+8801711222333',
  studentId: `ALDR-${Date.now() % 100000}`,
  batch: '2018',
  profession: 'Program Officer at BRAC',
  linkedinUrl: 'https://www.linkedin.com/in/marisol-quillen',
};
// Verified temp with nothing optional — exercises the initials fallback and
// the absent LinkedIn anchor
const TEMP_BARE = {
  name: 'Tobias Wrenfield',
  email: `tempbare${Date.now()}+tmp@dm-alumni.local`,
  phone: '+8801715556666',
  studentId: `ALDB-${Date.now() % 100000}`,
  batch: '2018',
};
// Pending temp — must never appear in counts or cards
const TEMP_PENDING = {
  name: 'Petra Pendelworth',
  email: `temppend${Date.now()}+tmp@dm-alumni.local`,
  phone: '+8801719990000',
  studentId: `ALDP-${Date.now() % 100000}`,
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

const log = (...a) => console.log('[dir]', ...a);
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
      for (const email of [EMAIL, TEMP_RICH.email, TEMP_BARE.email, TEMP_PENDING.email]) {
        await users.deleteOne({ email });
      }
      log('cleaned up Mongo records + Cloudinary assets for', EMAIL, '+ 3 temps');
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

async function insertTemp(users, { name, email, phone, studentId, batch }, extra = {}) {
  await users.insertOne({
    name,
    email,
    phone,
    studentId,
    batch,
    role: 'alumni',
    verificationStatus: 'verified',
    moderatorBatch: null,
    photo: null,
    docType: null,
    doc: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...extra,
  });
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

  // --- Sign-up + complete registration (same dance as admin-visual.cjs) ---
  const emailField = 'input[name="identifier"], input[name="emailAddress"]';
  await goto('/sign-up');
  await waitFor(() => page.locator(emailField).count());
  if (await page.locator('input[name="firstName"]').count())
    await page.locator('input[name="firstName"]').fill('Ivy');
  if (await page.locator('input[name="lastName"]').count())
    await page.locator('input[name="lastName"]').fill('Rectory');
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
    await shot('dir-stuck');
    const stuckBody = await page.textContent('body').catch(() => '');
    log('body snippet:', stuckBody.slice(0, 200).replace(/\s+/g, ' '));
    throw new Error('never reached /register');
  }
  await page.waitForTimeout(1500);
  await page.locator('#phone').fill('+8801712345678');
  await page.locator('#studentId').fill(STUDENT_ID);
  await page.locator('#batch').selectOption('2018');
  await page.locator('#profession').fill(ACTOR.profession);
  await page.locator('#linkedinUrl').fill(ACTOR.linkedinUrl);
  await page.setInputFiles('#photo', { name: 'photo.png', mimeType: 'image/png', buffer: PNG });
  await page.setInputFiles('#document', { name: 'doc.pdf', mimeType: 'application/pdf', buffer: PDF });
  await page.getByRole('button', { name: /Complete registration/i }).click();
  await page.waitForSelector('text=Welcome aboard', { timeout: 60000 });
  const actorDoc = await users.findOne({ email: EMAIL });
  check('registration: profession persisted', actorDoc?.profession === ACTOR.profession);
  check('registration: linkedinUrl persisted', actorDoc?.linkedinUrl === ACTOR.linkedinUrl);

  // --- Verified setup: flip the actor, add 2 verified + 1 pending temps ---
  const pre = await users.countDocuments({ batch: '2018', verificationStatus: 'verified' });
  await users.updateOne({ email: EMAIL }, { $set: { verificationStatus: 'verified' } });
  await insertTemp(users, TEMP_RICH, {
    profession: TEMP_RICH.profession,
    linkedinUrl: TEMP_RICH.linkedinUrl,
  });
  await insertTemp(users, TEMP_BARE); // no profession/linkedin at all
  await insertTemp(users, TEMP_PENDING, { verificationStatus: 'pending' });
  const expected = await users.countDocuments({ batch: '2018', verificationStatus: 'verified' });
  log(`2018 verified: pre=${pre}, after setup=${expected} (actor + 2 temps added)`);
  check('setup: verified count is pre + 3', expected === pre + 3);

  // --- Homepage: DB-backed count on the 2018 card + click navigates ---
  await goto('/');
  const card2018 = page.locator('a[href="/alumni/2018"]').first();
  // Poll — dev re-renders per request, but allow a full ISR window (60s)
  // anyway in case a cached page is ever served.
  const wantCount = `${expected} alumni`;
  const counted = await waitFor(async () => {
    const t = await card2018.textContent().catch(() => null);
    return !!t && t.includes(wantCount);
  }, 75000);
  if (!counted) {
    const t = await card2018.textContent().catch(() => '(card not found)');
    log('2018 card actually says:', JSON.stringify((t ?? '').replace(/\s+/g, ' ').trim()));
  }
  check('homepage: 2018 card shows DB count', counted);
  await shot('dir-home');
  await card2018.click();
  await page.waitForURL('**/alumni/2018');
  await page.waitForTimeout(1200);
  await shot('dir-directory');

  // --- Directory: roster, hidden pending member, card contents ---
  const cards = page.locator('article');
  check('directory: verified card count', (await cards.count()) === expected);
  let body = await page.textContent('main');
  check('directory: banner "N verified members"', body.includes(`${expected} verified members`));
  check('directory: pending member hidden', !body.includes(TEMP_PENDING.name));

  const actorCard = page.locator('article', { hasText: ACTOR.name });
  check('directory: actor card listed', (await actorCard.count()) === 1);
  check('directory: actor card marked (you)', (await actorCard.getByText('(you)', { exact: true }).count()) === 1);
  check('directory: actor card shows uploaded photo', (await actorCard.locator('img').count()) === 1);
  check('directory: actor LinkedIn link', (await actorCard.getByRole('link', { name: `${ACTOR.name} on LinkedIn` }).count()) === 1);

  const richCard = page.locator('article', { hasText: TEMP_RICH.name });
  check('directory: rich temp card listed', (await richCard.count()) === 1);
  const richText = (await richCard.textContent()) ?? '';
  check('directory: rich card profession', richText.includes(TEMP_RICH.profession));
  check('directory: rich card email', richText.includes(TEMP_RICH.email));
  check('directory: rich card phone', richText.includes(TEMP_RICH.phone));
  const richLi = richCard.getByRole('link', { name: `${TEMP_RICH.name} on LinkedIn` });
  check('directory: rich card LinkedIn anchor', (await richLi.count()) === 1);
  check(
    'directory: rich card LinkedIn href',
    (await richLi.count()) === 1 && (await richLi.first().getAttribute('href')) === TEMP_RICH.linkedinUrl
  );

  const bareCard = page.locator('article', { hasText: TEMP_BARE.name });
  check('directory: bare temp card listed', (await bareCard.count()) === 1);
  check('directory: bare card initials fallback TW', (await bareCard.getByText('TW', { exact: true }).count()) === 1);
  check('directory: bare card has no LinkedIn anchor', (await bareCard.locator('a[href*="linkedin"]').count()) === 0);
  check('directory: bare card has no profession line', !(await bareCard.locator('svg.lucide-briefcase').count()));

  // --- Search by name ---
  const search = page.locator('input[type="search"]');
  await search.fill('quillen');
  await page.waitForTimeout(400);
  check('search: narrows to 1 card', (await cards.count()) === 1);
  body = await page.textContent('main');
  check('search: "Showing 1 of" counter', body.includes(`Showing 1 of ${expected}`));
  await shot('dir-search');

  await search.fill('zzqxvjw');
  await page.waitForTimeout(400);
  check('search: no-match state', (await page.getByText('No members match').count()) === 1);
  const clearBtn = page.getByRole('button', { name: 'Clear search' });
  check('search: Clear search button offered', (await clearBtn.count()) === 1);
  await clearBtn.click();
  await page.waitForTimeout(400);
  check('search: clear restores full list', (await cards.count()) === expected);
  await shot('dir-nomatch');

  // --- Unknown batch 404s (while signed in) ---
  const res = await page.goto(`${BASE}/alumni/9999?${DVB}`, { waitUntil: 'domcontentloaded' });
  check('unknown batch: 404 status', res?.status() === 404);
  await shot('dir-404');

  // --- /profile shows the two new rows ---
  await goto('/profile');
  await page.waitForTimeout(1200);
  body = await page.textContent('main');
  check('/profile: profession row value', body.includes(ACTOR.profession));
  check('/profile: LinkedIn row', (await page.locator(`a[href="${ACTOR.linkedinUrl}"]`).count()) === 1);
  await shot('dir-profile');

  // --- /profile/edit carries the values; non-LinkedIn URL rejected ---
  await goto('/profile/edit');
  await page.waitForTimeout(1200);
  check('/profile/edit: profession input value', (await page.locator('#profession').inputValue()) === ACTOR.profession);
  check('/profile/edit: linkedinUrl input value', (await page.locator('#linkedinUrl').inputValue()) === ACTOR.linkedinUrl);

  await page.locator('#linkedinUrl').fill('https://github.com/not-linkedin');
  await page.getByRole('button', { name: 'Save changes' }).click();
  const rejected = await waitFor(() =>
    page.getByText('Enter a link to your LinkedIn profile (linkedin.com)').count()
  );
  check('edit: non-LinkedIn URL rejected with field error', rejected);
  await shot('dir-edit-error');

  await page.locator('#linkedinUrl').fill(ACTOR.linkedinUrl);
  await page.getByRole('button', { name: 'Save changes' }).click();
  check('edit: corrected save succeeds', await waitFor(() =>
    page.getByText('Profile updated successfully.').count()
  ));
  await shot('dir-edit');

  // --- Anonymous gate: signed-out /alumni/2018 redirects to /sign-in ---
  await context.clearCookies();
  await goto('/alumni/2018');
  await page.waitForTimeout(1500);
  check('gate: signed-out visit lands on /sign-in', page.url().includes('/sign-in'));
  await shot('dir-anon');

  log('page errors seen:', errors.length ? errors : 'none');
  check('zero page errors', errors.length === 0);
  await browser.close();
  await cleanup();
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exitCode = failures ? 1 : 0;
}

main().catch(async (e) => {
  console.error('[dir] fatal:', e);
  if (errors.length) console.error('[dir] page errors:', errors);
  await browserRef?.close().catch(() => {});
  await cleanup();
  process.exit(1);
});
