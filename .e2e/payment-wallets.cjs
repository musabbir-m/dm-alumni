/* Browser e2e for the payment-wallet + member-payment features.
 * Run against a FRESH PRODUCTION build (the user's long-lived dev server on
 * :3000 caches the pre-payment User model and silently drops the new fields):
 *   npm run build; npx next start -p 3100   (background)
 *   $env:E2E_BASE='http://localhost:3100'; node .e2e/payment-wallets.cjs
 * Deps installed --no-save — reinstall with
 * `npm i --no-save playwright @clerk/testing` if swept.
 *
 * The DB may hold REAL wallets the user designated (never assume a pristine
 * collection): wallet-count checks are relative to a baseline captured at
 * start, and no check ever deletes a wallet it didn't create.
 *
 * Actor 1 signs up + registers (real roster pair 1717062/2018 — the payment
 * section's visibility must match whether wallets exist, and a no-pick
 * registration starts unpaid) and is promoted to admin in Mongo; a plain
 * target member (batch 2018) is inserted directly.
 * Then, through the real /admin UI:
 *   - tabs render (Members default; Payments mirrors the DB baseline — the
 *     no-receivers empty state on a pristine DB, else the real receiver
 *     groups; Payment Wallets shows the empty state on a pristine DB, else
 *     the pre-existing receivers)
 *   - Add tab: batch select → searchable member picker → wallet type →
 *     number entered as "+880 1712-345678" and stored normalized 01712345678
 *   - wallet doc lands in `paymentWallets` with the identity snapshot
 *   - Payment Wallets tab shows the card; Edit → invalid number rejected,
 *     then Nagad/01812345678 saved → card shows the new values + "Edited",
 *     Mongo shows updatedAt > createdAt
 *   - Add tab again: the picked member now shows "Has wallet" (disabled)
 * Member-payment flow, same actor (the TrxID drives the status):
 *   - /profile/edit: gateway filter narrows the receiver dropdown (BKash
 *     hides Zephyr's nagad wallet, Nagad lists it with "Your batch" in the
 *     option label) → pick → save WITHOUT a TrxID → Mongo shows receiverId
 *     set but paymentStatus UNPAID; then the TrxID is filled and saved →
 *     pending + paymentTransactionId persisted
 *   - /profile shows the Pending dues badge + receiver card + the TrxID
 *   - /admin: unpaid rows show no payment buttons; target row (receiver +
 *     TrxID set via Mongo, pending) shows Mark paid but no Reset → Mark paid
 *     flips the badge and the doc to paid → Reset payment returns both to
 *     pending
 *   - payment-details info button: absent before a receiver is chosen; on
 *     receiver rows it opens a short modal (receiver name + wallet number +
 *     gateway badge + status + TrxID), Escape and backdrop-click close it
 *   - the Payments tab switches receivers by name-pill (one group at a
 *     time): Zephyr's group holds both the admin's and the target's picks
 *     (status + TrxID + the per-group summary), Mark paid's revalidation
 *     refreshes the unmounted panel's props, and the tab badge counts the
 *     pending queue
 * Actor 2 signs up + registers (1417003/2014) picking Zephyr as receiver
 * with a TrxID at /register (pending + TrxID in Mongo), then is promoted to
 * moderator (moderatorBatch 2017) — /admin shows Members + Payments (no
 * wallet tabs); the Payments tab is their read-only lens too.
 * Zero page errors across both contexts. No uploads → no Cloudinary assets.
 * Cleans up all three Mongo records + the wallet doc afterwards. */
const { chromium } = require('playwright');
const { clerkSetup, setupClerkTestingToken } = require('@clerk/testing/playwright');
const { createClerkClient } = require('@clerk/backend');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const FAPI = 'https://evident-ocelot-8419.clerk.accounts.dev';
const OUT = path.join(__dirname, 'artifacts');
fs.mkdirSync(OUT, { recursive: true });

const PASSWORD = 'TestPass!2026xyz'; // Clerk instance enforces 15+ chars
const STAMP = Date.now();
// All-lowercase: the User schema lowercases emails, and the Mongo promotion
// below matches by this exact string.
const ADMIN_EMAIL = `paywalla${STAMP}+clerk_test@example.com`;
const MOD_EMAIL = `paywallb${STAMP}+clerk_test@example.com`;
const TARGET = {
  name: 'Zephyr Quillstone',
  email: `pwt${STAMP}+tmp@dm-alumni.local`,
  phone: '+8801799888777',
  studentId: `PWT-${STAMP % 100000}`,
  batch: '2018',
};
// Real roster pairs (validated by completeProfile): 1717062 sits in both the
// 7th and 8th batch rosters — claimed here under 2018. 1417003 was the 2014
// fixture until a REAL member registered it through the dev server (same
// Atlas DB) and the moderator actor started failing "already registered in
// this batch" — run `node .e2e/check-pair.cjs` if this flake returns, and
// re-pick from its free-pairs output.
const ADMIN_PAIR = { studentId: '1717062', batch: '2018' };
const MOD_PAIR = { studentId: '1417002', batch: '2014' };
const WALLET_NUM_RAW = '+880 1712-345678'; // → 01712345678
const WALLET_NUM_FIX = '01812345678';
const TRX_EDIT = 'TRX9F7B2K1QZM'; // admin's receipt reference via /profile/edit
const TRX_REG = 'TRX4N2K7QP4M'; // moderator's receipt reference at /register
const TRX_TARGET = 'TRX-TGT-4242'; // target's evidence, set via Mongo

const log = (...a) => console.log('[pay]', ...a);
let failures = 0;
let browserRef = null;
const errors = [];
let clerkAdmin = null; // Backend API client — the force-verify fallback below
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
      const wallets = mongoose.connection.collection('paymentWallets');
      const target = await users.findOne({ email: TARGET.email });
      if (target) await wallets.deleteMany({ userId: target._id });
      await users.deleteOne({ email: ADMIN_EMAIL });
      await users.deleteOne({ email: MOD_EMAIL });
      await users.deleteOne({ email: TARGET.email });
      log('cleaned up wallet + Mongo records for', ADMIN_EMAIL, MOD_EMAIL, TARGET.email);
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

/** Switch the gateway filter and wait for the receiver dropdown to re-render
 * to exactly expectedOptions (the skip option + matching receivers). A
 * select change that lands before hydration is silently dropped — the option
 * count only moves once React processed it. */
async function gatewayFilter(page, type, expectedOptions) {
  for (let i = 0; i < 12; i++) {
    await page.locator('#payment-gateway').selectOption(type);
    if ((await page.locator('#payment-receiver option').count()) === expectedOptions)
      return true;
    await page.waitForTimeout(300);
  }
  return false;
}

/** Fresh context wired to its own Clerk dev-browser token. */
async function makeActor(browser, label) {
  const dbRes = await fetch(`${FAPI}/v1/dev_browser`, { method: 'POST' });
  const devBrowser = await dbRes.json();
  if (!devBrowser.token) throw new Error(`could not create Clerk dev browser for ${label}`);
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    args: undefined,
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();
  await setupClerkTestingToken({ page });
  const goto = (p) =>
    page.goto(BASE + p + (p.includes('?') ? '&' : '?') + `__clerk_db_jwt=${devBrowser.token}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
  page.on('pageerror', (e) => errors.push(`[${label}] ${String(e).slice(0, 160)}`));
  page.on('requestfailed', (r) => {
    const url = r.url();
    if (!/clerk|cloudflare/.test(url))
      log(`REQUEST FAILED ${r.method()} ${url.split('?')[0]}`);
  });
  // Timing trace for the profile-edit action POST — distinguishes a slow /
  // hung server action from a browser-side render problem.
  const actionT0 = new Map();
  page.on('request', (r) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === '/profile/edit')
      actionT0.set(r, Date.now());
  });
  page.on('requestfinished', (r) => {
    if (actionT0.has(r)) {
      log(`TRACE POST /profile/edit completed after ${Date.now() - actionT0.get(r)}ms`);
      actionT0.delete(r);
    }
  });
  return { context, page, goto };
}

/** completeProfile requires a VERIFIED email. The dev instance's sign-up flow
 * verifies it while email verification is on (the OTP 424242 path below);
 * with the setting off (2026-11: turned off while debugging sign-in step-up
 * codes — it also bricks every real local registration until re-enabled),
 * sign-ups land unverified — force-verify the throwaway through the Backend
 * API so registration can complete. */
async function ensureClerkVerified(email) {
  let user = null;
  for (let i = 0; i < 10 && !user; i++) {
    const res = await clerkAdmin.users.getUserList({ emailAddress: [email] });
    user = (res.data || res || [])[0];
    if (!user) await new Promise((r) => setTimeout(r, 300));
  }
  const em = user && (user.emailAddresses || [])[0];
  if (!em) throw new Error(`no Clerk email address for ${email}`);
  if (em.verification && em.verification.status === 'verified') return;
  await clerkAdmin.emailAddresses.updateEmailAddress(em.id, { verified: true });
  log('force-verified', email, '(dev instance sign-up verification is off)');
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
    if (!(await waitFor(() => page.url().includes('/register'), 8000))) {
      const cont = page.locator('button.cl-formButtonPrimary:not([disabled])').first();
      if (await waitFor(() => cont.count(), 5000)) {
        await cont.click({ timeout: 10000 }).catch(() => {});
      }
    }
  }
  await page.waitForURL('**/register', { timeout: 45000 });
  await ensureClerkVerified(email);
}

/** Fill the step-2 alumni form (no uploads) and submit. When pick is given
 * ({id, trx}), choose that receiver in the dropdown and enter the TrxID;
 * otherwise assert the section's visibility matches whether wallets exist
 * (real wallets may legitimately pre-date this run). Selects hydrate late
 * like radios did — assert the hidden paymentReceiverId input caught the
 * pick before submitting. Text fills that land pre-hydration are silently
 * dropped by React and then WIPED by the next re-render (the pick above
 * proves hydration and forces one) — so the identity fields are re-asserted
 * afterwards; a wipe here is what sends an empty phone/batch to the server
 * and looks like a hung submit. */
async function completeRegistration(page, pair, pick, baselineWallets = 0) {
  await page.waitForTimeout(1500);
  const phone = page.locator('#phone');
  const sid = page.locator('#studentId');
  const batchSel = page.locator('#batch');
  await phone.fill('+8801712345678');
  await sid.fill(pair.studentId);
  await batchSel.selectOption(pair.batch);
  if (pick) {
    const dropdown = page.locator('#payment-receiver');
    if (!(await waitFor(() => dropdown.count().then((n) => n === 1), 8000))) {
      check('register: receiver dropdown visible', false);
    } else {
      const hidden = page.locator('input[name="paymentReceiverId"]');
      let picked = false;
      for (let i = 0; i < 10 && !picked; i++) {
        await dropdown.selectOption(pick.id);
        picked = (await hidden.inputValue()) === pick.id;
        if (!picked) await page.waitForTimeout(300);
      }
      check('register: receiver pick caught by React (hidden input)', picked);
      // Re-assert the identity fields now that hydration is proven
      for (let i = 0; i < 10; i++) {
        if ((await phone.inputValue()) !== '+8801712345678') await phone.fill('+8801712345678');
        if ((await sid.inputValue()) !== pair.studentId) await sid.fill(pair.studentId);
        if ((await batchSel.inputValue()) !== pair.batch) await batchSel.selectOption(pair.batch);
        if (
          (await phone.inputValue()) === '+8801712345678' &&
          (await sid.inputValue()) === pair.studentId &&
          (await batchSel.inputValue()) === pair.batch
        )
          break;
        await page.waitForTimeout(300);
      }
      check(
        'register: identity fields survived hydration',
        (await phone.inputValue()) === '+8801712345678' &&
          (await sid.inputValue()) === pair.studentId &&
          (await batchSel.inputValue()) === pair.batch
      );
      if (pick.trx) {
        const trx = page.locator('#payment-transaction-id');
        const enabled = await waitFor(() => trx.isEnabled().catch(() => false), 5000);
        check('register: trx input enabled after pick', enabled);
        if (enabled) await trx.fill(pick.trx);
      }
    }
  } else {
    const sectionCount = await page.locator('#payment-receiver').count();
    check(
      'register: payment section visibility matches wallet existence',
      (sectionCount === 1) === (baselineWallets > 0)
    );
  }
  await page.getByRole('button', { name: /Complete registration/i }).click();
  const ok = await waitFor(
    () => page.locator('text=Welcome aboard').count().then((n) => n > 0),
    60000
  );
  if (!ok) {
    // A field error (e.g. the roster pair got claimed by a real member) keeps
    // the form standing with alerts — dump them instead of timing out blind.
    const alerts = await page.locator('[role="alert"]').allTextContents();
    log('registration diagnostics — alerts:', JSON.stringify(alerts));
    await page
      .screenshot({ path: path.join(OUT, 'register-fail.png'), fullPage: true })
      .catch(() => {});
    throw new Error('registration did not reach the Welcome aboard panel');
  }
}

async function main() {
  loadEnvLocal();
  clerkAdmin = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.collection('users');
  const walletsCol = mongoose.connection.collection('paymentWallets');

  // Self-heal stale runs (never touches real member records — email-guarded)
  for (const pair of [ADMIN_PAIR, MOD_PAIR]) {
    const stale = await users.findOne({ ...pair, email: /clerk_test/ });
    if (stale) {
      await walletsCol.deleteMany({ userId: stale._id });
      await users.deleteOne({ _id: stale._id });
      log('self-heal: removed stale test user', stale.email);
    }
  }

  await clerkSetup();
  const browser = (browserRef = await chromium.launch({
    args: ['--disable-blink-features=AutomationControlled'],
  }));

  // Baseline AFTER self-heal — real receivers the user designated may exist;
  // every wallet-count assertion below is relative to this number. The
  // per-type baselines back the gateway-filter dropdown checks (the run's
  // own wallet is created as rocket, then edited to nagad, during the run).
  const baselineWallets = await walletsCol.countDocuments({});
  const baseByType = {};
  for (const t of ['bkash', 'rocket', 'nagad']) {
    baseByType[t] = await walletsCol.countDocuments({ walletType: t });
  }
  log('baseline paymentWallets in DB:', baselineWallets, baseByType);

  // ---------------- Actor 1: the admin ----------------
  const admin = await makeActor(browser, 'admin');
  const { page, goto } = admin;
  await signUpActor(page, goto, ADMIN_EMAIL, 'Ada', 'Paywell');
  await completeRegistration(page, ADMIN_PAIR, null, baselineWallets);
  const adminDoc0 = await users.findOne({ email: ADMIN_EMAIL });
  check(
    'mongo: registration without a receiver starts unpaid',
    !!adminDoc0 && adminDoc0.paymentStatus === 'unpaid' && adminDoc0.paymentReceiverId == null
  );
  await users.updateOne(
    { email: ADMIN_EMAIL },
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
    clerkId: null,
    moderatorBatch: null,
    photo: null,
    docType: null,
    doc: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  log('actor 1 is admin; target inserted');

  await goto('/admin');
  await page.waitForTimeout(1500);
  const tab = (name) => page.getByRole('tab', { name });
  check('/admin: Staff dashboard heading', (await page.locator('h1').textContent()) === 'Staff dashboard');
  check('tabs: four for admin', (await page.locator('[role="tab"]').count()) === 4);
  check('tabs: Members selected by default', (await tab('Members').getAttribute('aria-selected')) === 'true');
  check('members panel: target row listed', await waitFor(() => page.locator('li', { hasText: TARGET.name }).count().then((n) => n === 1)));
  // The target starts with no payment fields — Mark paid is a pending-only
  // button (the member's TrxID submission opens it), so it must not render.
  check(
    'admin: unpaid row hides Mark paid',
    (await page.locator('li', { hasText: TARGET.name }).getByRole('button', { name: 'Mark paid' }).count()) === 0
  );
  // No receiver chosen yet — nothing for the payment-details modal to show
  check(
    'admin: no-receiver row hides the payment info button',
    (await page
      .locator('li', { hasText: TARGET.name })
      .getByRole('button', { name: `Payment details for ${TARGET.name}` })
      .count()) === 0
  );

  // Payments tab — mirrors the DB baseline like the Wallets tab does: the
  // no-receivers empty state on a pristine DB, else the real receiver groups
  // (never assert their names — they're real data).
  await tab('Payments').click();
  await page.waitForTimeout(500);
  const payBody = await page.locator('[role="tabpanel"]').textContent();
  check(
    'payments tab: state matches DB baseline',
    baselineWallets === 0
      ? payBody.includes('No payment receivers')
      : !payBody.includes('No payment receivers')
  );

  // Wallets tab — empty state on a pristine DB; on a live DB the real
  // receivers are listed instead (never assert their names, they're real data)
  await tab('Payment Wallets').click();
  await page.waitForTimeout(500);
  let body = await page.locator('[role="tabpanel"]').textContent();
  check(
    'wallets tab: state matches DB baseline',
    baselineWallets === 0
      ? body.includes('No payment wallets yet')
      : !body.includes('No payment wallets yet')
  );

  // Add flow
  await tab('Add Payment Wallet').click();
  await page.waitForTimeout(500);
  check('add tab: member search disabled before batch', await page.locator('#wallet-member').isDisabled());
  await page.locator('#wallet-batch').selectOption(TARGET.batch);
  await page.locator('#wallet-member').click(); // focus opens the dropdown
  const option = page.locator('#wallet-member-list [role="option"]', { hasText: TARGET.name });
  check('picker: batch members loaded', await waitFor(() => option.count().then((n) => n === 1)));
  await page.locator('#wallet-member').fill('Zephyr');
  check('picker: search narrows to target', (await page.locator('#wallet-member-list [role="option"]').count()) === 1);
  await option.click();
  check('picker: person selected (card with Change)', (await page.getByRole('button', { name: 'Change' }).count()) === 1);
  check('add tab: BKash radio default', (await page.getByRole('radio', { name: 'BKash' }).getAttribute('aria-checked')) === 'true');
  await page.getByRole('radio', { name: 'Rocket' }).click();
  await page.locator('#wallet-number').fill(WALLET_NUM_RAW);
  await page.getByRole('button', { name: /Add payment wallet/i }).click();
  check(
    'add: success message with normalized number',
    await waitFor(() =>
      page
        .locator('[role="status"]', { hasText: 'now receives payments via Rocket 01712345678' })
        .count()
        .then((n) => n === 1)
    )
  );

  // Direct Mongo verification of the created doc
  const target = await users.findOne({ email: TARGET.email });
  const walletDoc = target ? await walletsCol.findOne({ userId: target._id }) : null;
  check(
    'mongo: wallet doc snapshot + normalized number',
    !!walletDoc &&
      walletDoc.name === TARGET.name &&
      walletDoc.studentId === TARGET.studentId &&
      walletDoc.batch === TARGET.batch &&
      walletDoc.photo === '' &&
      walletDoc.walletType === 'rocket' &&
      walletDoc.walletNumber === '01712345678'
  );

  // Wallets tab shows the card (count badge flipped to baseline+1 via
  // revalidation). The badge renders inside the tab as "Payment Wallets2" —
  // \b can't match between "s" and the digit, so anchor on the label + count.
  const expectedBadge = new RegExp(`Payment Wallets\\s*${baselineWallets + 1}`);
  check(`tabs: wallets count badge = ${baselineWallets + 1}`, await waitFor(() =>
    tab('Payment Wallets').textContent().then((t) => expectedBadge.test(t))
  ));
  await tab('Payment Wallets').click();
  const card = page.locator('li', { hasText: TARGET.name });
  check('wallets tab: card listed', await waitFor(() => card.count().then((n) => n === 1)));
  body = await card.textContent();
  check('wallets tab: Rocket + normalized number + Added', body.includes('Rocket') && body.includes('01712345678') && body.includes('Added'));
  check('wallets tab: no Edited note yet', !body.includes('Edited'));

  // Edit: invalid number rejected, then a real change saves with "Edited"
  await card.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('radio', { name: 'Nagad' }).click();
  const editNumber = page.locator('input[type="tel"]');
  await editNumber.fill('12345');
  await page.getByRole('button', { name: 'Save changes' }).click();
  check(
    'edit: invalid number field error',
    await waitFor(() =>
      page
        .locator('[role="alert"]', { hasText: 'valid Bangladeshi mobile number' })
        .count()
        .then((n) => n === 1)
    )
  );
  await editNumber.fill(WALLET_NUM_FIX);
  await page.getByRole('button', { name: 'Save changes' }).click();
  check('edit: editor closes on save', await waitFor(() =>
    card.getByRole('button', { name: 'Edit' }).count().then((n) => n === 1)
  ));
  // The revalidated row needs a beat to land — wait for the card content
  // itself instead of reading once and racing React's update.
  check('edit: card shows Nagad + new number + Edited', await waitFor(() =>
    card
      .textContent()
      .then((t) => t.includes('Nagad') && t.includes(WALLET_NUM_FIX) && t.includes('Edited'))
  ));
  const walletAfter = await walletsCol.findOne({ userId: target._id });
  check(
    'mongo: edit persisted + updatedAt drifted',
    !!walletAfter &&
      walletAfter.walletType === 'nagad' &&
      walletAfter.walletNumber === WALLET_NUM_FIX &&
      walletAfter.updatedAt.getTime() > walletAfter.createdAt.getTime()
  );

  // Add tab again: the same member is flagged as having a wallet already.
  // The Add form remounts fresh (tabs unmount their panels), so re-select
  // the batch before opening the picker.
  await tab('Add Payment Wallet').click();
  await page.waitForTimeout(500);
  await page.locator('#wallet-batch').selectOption(TARGET.batch);
  await page.locator('#wallet-member').click();
  const flagged = page.locator('#wallet-member-list [role="option"]', { hasText: 'Has wallet' });
  check('picker: added member now flagged "Has wallet"', await waitFor(() => flagged.count().then((n) => n === 1)));

  // ---------------- Member-payment flow (same admin actor) ----------------
  // Give the directly-inserted target member a receiver choice + TrxID (no
  // UI for their registration — they predate it), then exercise the surfaces.
  await users.updateOne(
    { email: TARGET.email },
    {
      $set: {
        paymentReceiverId: walletAfter._id,
        paymentStatus: 'pending',
        paymentTransactionId: TRX_TARGET,
      },
    }
  );

  // /profile/edit: gateway-filtered dropdown pick + TrxID through the real form
  await goto('/profile/edit');
  await page.waitForTimeout(1500);
  const receiverSel = page.locator('#payment-receiver');
  check('edit: picker dropdown rendered', await waitFor(() => receiverSel.count().then((n) => n === 1)));
  check(
    'edit: trx input disabled before a receiver pick',
    await page.locator('#payment-transaction-id').isDisabled()
  );
  // Gateway filter narrows the list. Option counts are relative to the
  // per-type baselines: skip option + receivers of that gateway (+ Zephyr's
  // wallet, which was edited to nagad above, for the nagad case).
  const zephyrOption = page.locator('#payment-receiver option', { hasText: TARGET.name });
  check(
    'edit: bkash filter hides the nagad receiver',
    (await gatewayFilter(page, 'bkash', 1 + baseByType.bkash)) &&
      (await zephyrOption.count()) === 0
  );
  check(
    'edit: nagad filter lists the receiver',
    (await gatewayFilter(page, 'nagad', 2 + baseByType.nagad)) &&
      (await zephyrOption.count()) === 1
  );
  check(
    'edit: receiver option carries the Your-batch note',
    ((await zephyrOption.textContent()) || '').includes('Your batch')
  );
  // A selectOption that lands before hydration completes is silently dropped
  // — verify the hidden input caught the pick, retrying until it does.
  const hidden = page.locator('input[name="paymentReceiverId"]');
  let picked = false;
  for (let i = 0; i < 10 && !picked; i++) {
    await receiverSel.selectOption(walletAfter._id.toString());
    picked = (await hidden.inputValue()) === walletAfter._id.toString();
    if (!picked) await page.waitForTimeout(300);
  }
  check('edit: receiver pick caught by React (hidden input)', picked);
  check(
    'edit: trx input enabled after pick',
    !(await page.locator('#payment-transaction-id').isDisabled())
  );
  // Save #1 WITHOUT a TrxID — a receiver alone must keep the dues unpaid
  await page.getByRole('button', { name: /Save changes/i }).click();
  const saveT0 = Date.now();
  const saved = await waitFor(() =>
    page
      .locator('[role="status"]', { hasText: 'Profile updated successfully' })
      .count()
      .then((n) => n === 1)
  );
  if (!saved) {
    // Distinguish a slow/hung action POST (see the TRACE line) from a client
    // render problem: dump any alert text and the page state at failure.
    const alerts = await page.locator('[role="alert"]').allTextContents();
    const saveBtn = await page
      .getByRole('button', { name: /Save changes|Saving changes/i })
      .textContent()
      .catch(() => '(button not found)');
    log(
      `save diagnostics after ${Date.now() - saveT0}ms — button: ${saveBtn.trim()} — alerts:`,
      JSON.stringify(alerts)
    );
    await page
      .screenshot({ path: path.join(OUT, 'profile-edit-save-fail.png'), fullPage: true })
      .catch(() => {});
  }
  check('edit: first save (receiver only) succeeds', saved);
  check(
    'mongo: receiver without a TrxID stays unpaid',
    await waitFor(() =>
      users
        .findOne({ email: ADMIN_EMAIL })
        .then(
          (d) =>
            !!d &&
            d.paymentStatus === 'unpaid' &&
            d.paymentReceiverId?.toString() === walletAfter._id.toString() &&
            (d.paymentTransactionId ?? '') === ''
        )
    )
  );

  // Save #2 WITH the TrxID — that's what moves unpaid → pending. The success
  // panel from save #1 still matches the locator, so wait on the Mongo doc
  // instead; and never submit while the button is still pending.
  const saveBtn = page.getByRole('button', { name: /Save changes/i });
  const btnReady = await waitFor(() => saveBtn.isEnabled().catch(() => false));
  await page.locator('#payment-transaction-id').fill(TRX_EDIT);
  await saveBtn.click();
  const trxSaved = await waitFor(() =>
    users
      .findOne({ email: ADMIN_EMAIL })
      .then(
        (d) => !!d && d.paymentStatus === 'pending' && d.paymentTransactionId === TRX_EDIT
      )
  );
  if (!trxSaved) {
    const alerts = await page.locator('[role="alert"]').allTextContents();
    log('trx save diagnostics — alerts:', JSON.stringify(alerts));
    await page
      .screenshot({ path: path.join(OUT, 'profile-edit-trx-fail.png'), fullPage: true })
      .catch(() => {});
  }
  check('edit: TrxID save flips dues to pending', trxSaved && btnReady);
  const adminDoc1 = await users.findOne({ email: ADMIN_EMAIL });
  check(
    'mongo: own receiver choice + TrxID persisted as pending',
    !!adminDoc1 &&
      adminDoc1.paymentStatus === 'pending' &&
      adminDoc1.paymentReceiverId?.toString() === walletAfter._id.toString() &&
      adminDoc1.paymentTransactionId === TRX_EDIT
  );

  // /profile: badge + receiver card with the wallet number + the TrxID
  await goto('/profile');
  await page.waitForTimeout(1000);
  // Admin actor is verified + dues pending: exactly two exact-"Pending" badges
  // (the header's Dues badge and the Membership-payment section's Dues badge).
  check(
    'profile: Pending dues badge + receiver card',
    await waitFor(() =>
      page
        .getByText('Pending', { exact: true })
        .count()
        .then((n) => n === 2)
    ) &&
      (await page.getByText(WALLET_NUM_FIX).count()) >= 1 &&
      (await page.locator('a[href^="tel:"]').count()) >= 1
  );
  check(
    'profile: submitted TrxID shown',
    (await page.getByText('Transaction ID submitted:').count()) === 1 &&
      (await page.getByText(TRX_EDIT).count()) >= 1
  );

  // /admin: Mark paid → Paid → Reset payment → Pending. The target's
  // verification is ALSO pending, so the row carries two exact-"Pending"
  // badges (Status column + Payment column) until payment flips to Paid.
  await goto('/admin');
  await page.waitForTimeout(1500);
  const targetRow = page.locator('li', { hasText: TARGET.name });
  check(
    'admin: target row shows both Pending badges (verification + dues)',
    await waitFor(() => targetRow.getByText('Pending', { exact: true }).count().then((n) => n === 2))
  );
  check(
    'admin: target row shows the TrxID evidence',
    (await targetRow.getByText(`TrxID ${TRX_TARGET}`).count()) === 1
  );

  // Payment-details modal — the receiver identity behind the info button.
  // The modal portals to document.body (outside the row), so locate by role.
  const infoBtn = targetRow.getByRole('button', {
    name: `Payment details for ${TARGET.name}`,
  });
  check('admin: receiver row shows the payment info button', (await infoBtn.count()) === 1);
  await infoBtn.click();
  const dialog = page.getByRole('dialog');
  check(
    'modal: receiver name + wallet number + gateway badge',
    (await waitFor(() => dialog.count().then((n) => n === 1))) &&
      (await dialog.getByText(TARGET.name).count()) >= 1 &&
      (await dialog.getByText(WALLET_NUM_FIX, { exact: true }).count()) === 1 &&
      (await dialog.getByText('Nagad', { exact: true }).count()) === 1
  );
  check(
    'modal: status badge + submitted TrxID',
    (await dialog.getByText('Pending', { exact: true }).count()) === 1 &&
      (await dialog.getByText(TRX_TARGET).count()) === 1
  );
  // Screenshots must capture the settled modal: dialog.count() flips the instant
  // the portal mounts, while the 180ms entrance animation is still at opacity 0
  // — an immediate screenshot renders a ghost (probe-verified).
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'payment-modal-light.png') });
  await page.keyboard.press('Escape');
  check('modal: Escape closes', await waitFor(() => dialog.count().then((n) => n === 0)));
  // Reopen, then close via the backdrop (a corner click lands on the overlay)
  await targetRow
    .getByRole('button', { name: `Payment details for ${TARGET.name}` })
    .click();
  check('modal: reopens', await waitFor(() => dialog.count().then((n) => n === 1)));
  await page.mouse.click(24, 24);
  check('modal: backdrop click closes', await waitFor(() => dialog.count().then((n) => n === 0)));
  // Dark-mode pass — emulateMedia persists across the reload, and the inline
  // theme script applies the (dark) OS preference before first paint.
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await page.waitForTimeout(1500);
  await page
    .locator('li', { hasText: TARGET.name })
    .getByRole('button', { name: `Payment details for ${TARGET.name}` })
    .click();
  check('modal: reopens in dark mode', await waitFor(() => dialog.count().then((n) => n === 1)));
  await page.waitForTimeout(400); // entrance animation settle (see above)
  await page.screenshot({ path: path.join(OUT, 'payment-modal-dark.png') });
  // Phone-width pass — the dialog docks to the bottom (items-end below sm)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'payment-modal-mobile.png') });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await page.waitForTimeout(1500);
  check(
    'admin: pending row hides Reset payment',
    (await targetRow.getByRole('button', { name: 'Reset payment' }).count()) === 0
  );
  await targetRow.getByRole('button', { name: 'Mark paid' }).click();
  check(
    'admin: mark paid flips the badge to Paid',
    await waitFor(() => targetRow.getByText('Paid', { exact: true }).count().then((n) => n === 1))
  );
  check(
    'mongo: target marked paid',
    (await users.findOne({ email: TARGET.email }))?.paymentStatus === 'paid'
  );

  // Payments tab — the same revalidation that flipped the Members badge
  // refreshed this (unmounted) panel's props: the target's row is Paid while
  // the admin's own pick stays pending, both under Zephyr's group.
  check(
    'tabs: Payments badge counts the pending queue',
    /Payments\s*\d+/.test((await tab('Payments').textContent()) || '')
  );
  await tab('Payments').click();
  await page.waitForTimeout(500);
  // Receiver name-pills — one per receiver (the run's wallet + any real
  // ones). Only the SELECTED receiver's group renders (the first pill by
  // default), so click Zephyr's before asserting the group.
  check(
    'payments tab: receiver pills list every receiver',
    (await page.locator('[role="tabpanel"] button[aria-pressed]').count()) ===
      baselineWallets + 1
  );
  await page
    .locator('[role="tabpanel"]')
    .getByRole('button', { name: TARGET.name })
    .click();
  await page.waitForTimeout(300);
  check(
    'payments tab: only the selected receiver group renders',
    (await page.locator('[role="tabpanel"] section').count()) === 1
  );
  const zephyrGroup = page.locator('section', { hasText: TARGET.name });
  check(
    'payments tab: receiver group header (number + gateway)',
    (await waitFor(() =>
      zephyrGroup.getByText(WALLET_NUM_FIX, { exact: true }).count().then((n) => n >= 1)
    )) && (await zephyrGroup.getByText('Nagad', { exact: true }).count()) >= 1
  );
  const paymentsTabText = await page.locator('[role="tabpanel"]').textContent();
  check(
    'payments tab: summary line counts chosen + pending',
    paymentsTabText.includes('chose a receiver') &&
      paymentsTabText.includes('awaiting confirmation')
  );
  check(
    'payments tab: both members grouped under their receiver',
    (await zephyrGroup.getByText('Ada Paywell').count()) >= 1 &&
      (await zephyrGroup.getByText(TARGET.name).count()) >= 1
  );
  check(
    'payments tab: member rows carry status + TrxID',
    (await zephyrGroup.getByText('Paid', { exact: true }).count()) === 1 &&
      (await zephyrGroup.getByText('Pending', { exact: true }).count()) === 1 &&
      (await zephyrGroup.getByText(`TrxID ${TRX_TARGET}`).count()) === 1 &&
      (await zephyrGroup.getByText(`TrxID ${TRX_EDIT}`).count()) === 1
  );
  check(
    'payments tab: group summary counts members by status',
    (await zephyrGroup.getByText('2 members', { exact: true }).count()) === 1 &&
      (await zephyrGroup.getByText('1 pending', { exact: true }).count()) === 1 &&
      (await zephyrGroup.getByText('1 paid', { exact: true }).count()) === 1
  );
  await page.screenshot({ path: path.join(OUT, 'payments-tab-light.png') });
  // Switching pills swaps the list — the first pill is a real receiver on a
  // live DB, so Zephyr's members must disappear (pristine DB has only
  // Zephyr, so the swap is a no-op and the check is skipped).
  if (baselineWallets > 0) {
    await page.locator('[role="tabpanel"] button[aria-pressed]').first().click();
    await page.waitForTimeout(300);
    check(
      'payments tab: switching receivers swaps the list',
      (await page.locator('[role="tabpanel"]').getByText(`TrxID ${TRX_TARGET}`).count()) === 0
    );
  }
  // Back to Members for the reset flow
  await tab('Members').click();
  await page.waitForTimeout(500);

  await targetRow.getByRole('button', { name: 'Reset payment' }).click();
  check(
    'admin: reset payment returns the dues badge to Pending',
    await waitFor(() => targetRow.getByText('Pending', { exact: true }).count().then((n) => n === 2))
  );
  check(
    'mongo: target back to pending',
    (await users.findOne({ email: TARGET.email }))?.paymentStatus === 'pending'
  );

  // ---------------- Actor 2: a moderator sees no wallet tabs ----------------
  const mod = await makeActor(browser, 'moderator');
  await signUpActor(mod.page, mod.goto, MOD_EMAIL, 'Moe', 'Moderato');
  // Wallets now exist, so their registration offers the receiver dropdown —
  // pick Zephyr (a different batch: 2014 vs 2018, no "Your batch" note)
  // with a TrxID from the (fictional) receipt.
  await completeRegistration(mod.page, MOD_PAIR, {
    id: walletAfter._id.toString(),
    trx: TRX_REG,
  });
  const modDoc = await users.findOne({ email: MOD_EMAIL });
  check(
    'mongo: receiver + TrxID picked at registration lands as pending',
    !!modDoc &&
      modDoc.paymentStatus === 'pending' &&
      modDoc.paymentReceiverId?.toString() === walletAfter._id.toString() &&
      modDoc.paymentTransactionId === TRX_REG
  );
  await users.updateOne(
    { email: MOD_EMAIL },
    { $set: { role: 'moderator', moderatorBatch: '2017', verificationStatus: 'verified' } }
  );
  await mod.goto('/admin');
  await mod.page.waitForTimeout(1500);
  check(
    'moderator: Members + Payments tabs (no wallet tabs)',
    (await mod.page.locator('[role="tab"]').count()) === 2
  );
  check(
    'moderator: member list still renders',
    (await mod.page.locator('li', { hasText: TARGET.name }).count()) === 1
  );
  // Read-only payment info rides along for moderators (they confirm dues for
  // their own batch — receiver identity is context, wallet management isn't)
  check(
    'moderator: payment info button visible (read-only receiver info)',
    (await mod.page
      .locator('li', { hasText: TARGET.name })
      .getByRole('button', { name: `Payment details for ${TARGET.name}` })
      .count()) === 1
  );
  // The Payments tab is the same read-only lens — click Zephyr's receiver
  // pill, then the moderator's own registration pick shows in the group
  await mod.page.getByRole('tab', { name: 'Payments' }).click();
  await mod.page.waitForTimeout(500);
  const modPanel = mod.page.locator('[role="tabpanel"]');
  await modPanel.getByRole('button', { name: TARGET.name }).click();
  await mod.page.waitForTimeout(300);
  check(
    'moderator: Payments tab renders (read-only, own pick included)',
    (await modPanel.getByText(WALLET_NUM_FIX, { exact: true }).count()) >= 1 &&
      (await modPanel.getByText('Moe Moderato').count()) >= 1 &&
      (await modPanel.getByText(`TrxID ${TRX_REG}`).count()) === 1
  );

  check('zero page errors across both contexts', errors.length === 0);
  if (errors.length) log('page errors:', errors);

  await browser.close();
  await cleanup();
  log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('[pay] fatal:', e.message);
  if (browserRef) await browserRef.close().catch(() => {});
  await cleanup();
  process.exit(1);
});
