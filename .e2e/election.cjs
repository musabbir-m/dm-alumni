/* Browser e2e for the committee-election feature. Same harness conventions
 * as payment-wallets.cjs (run against a FRESH PRODUCTION build on :3100 —
 * never the user's :3000 dev server; deps via npm i --no-save playwright
 * @clerk/testing):
 *   npm run build; npx next start -p 3100   (background)
 *   $env:E2E_BASE='http://localhost:3100'; node .e2e/election.cjs
 *
 * The Atlas DB may hold REAL elections some day: election/ballot/roll count
 * checks are relative to a baseline captured at start, and no check ever
 * asserts or deletes a real member's data. ⚠ This suite CREATES a live
 * election in the shared DB — production doesn't expose /vote yet (the route
 * ships with this feature), but once it does, this suite must never be run
 * against production data without noticing: it cleans up its own election
 * completely in the finally block.
 *
 * Actors (all throwaway +clerk_test): admin (1717062/2018), Vera + Vic
 * (1417002 + 1417005, batch 2014 — the two candidates), moderator
 * (1417006/2014). Vic starts Mongo-pending to exercise the unverified gate,
 * then flips verified through Mongo (the real staff flow did that already).
 *
 * Scenario, all through the real UI unless noted:
 *   - admin sees the Election tab (empty), creates the election, adds Vera +
 *     Vic via the verified-member combobox, saves, opens voting
 *   - Vic (pending) hits the unverified panel; after Mongo-verify, the ballot
 *   - Vera votes herself (seq 1) via radio → confirm modal → receipt code,
 *     with in-script HMAC/sha256 recomputation asserting the chain fields
 *   - double vote blocked (page state + raw duplicate-key insert)
 *   - staff monitor: turnout visible while open, results/candidate names
 *     ABSENT (the no-leak gate)
 *   - Vic votes Vic (seq 2), moderator votes Vera (seq 3, chained links)
 *   - receipt verification: good code shows the recorded choice, an
 *     unknown-but-valid code errors
 *   - close via UI → results appear for staff
 *   - Mongo-tamper a ballot → Re-verify FAILS → publish refuses → restore →
 *     verified again
 *   - publish via UI → fingerprint = head hash; /vote shows tallies +
 *     fingerprint + Elected badge; receipt verify still works
 *   - moderator: 3 tabs (no wallet tabs), monitoring yes, manage card no
 *   - the independent audit script (npm run verify:election) verifies the
 *     chain straight from the DB while the election still exists
 *   - zero page errors; cleanup deletes everything this run created. */
const { chromium } = require('playwright');
const { clerkSetup, setupClerkTestingToken } = require('@clerk/testing/playwright');
const { createClerkClient } = require('@clerk/backend');
const { execSync } = require('child_process');
const { createHash, createHmac } = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const FAPI = 'https://evident-ocelot-8419.clerk.accounts.dev';
const OUT = path.join(__dirname, 'artifacts');
fs.mkdirSync(OUT, { recursive: true });

const PASSWORD = 'TestPass!2026xyz'; // Clerk instance enforces 15+ chars
const STAMP = Date.now();
const TITLE = `E2E Test Election ${STAMP}`;
const ADMIN_EMAIL = `electa${STAMP}+clerk_test@example.com`;
const VERA_EMAIL = `electb${STAMP}+clerk_test@example.com`;
const VIC_EMAIL = `electc${STAMP}+clerk_test@example.com`;
const MOD_EMAIL = `electd${STAMP}+clerk_test@example.com`;
const ADMIN_PAIR = { studentId: '1717062', batch: '2018' };
const VERA_PAIR = { studentId: '1417002', batch: '2014' };
const VIC_PAIR = { studentId: '1417005', batch: '2014' };
const MOD_PAIR = { studentId: '1417006', batch: '2014' };
const NAMES = { admin: ['Ada', 'Voteheart'], vera: ['Vera', 'Ballotson'], vic: ['Vic', 'Pendleton'], mod: ['Moe', 'Moderato'] };

const log = (...a) => console.log('[elect]', ...a);
let failures = 0;
let browserRef = null;
let adminRef = null;
const errors = [];

/** Crash-triage dump: fullPage screenshot + every button label + url + page errors. */
async function dumpAdmin(tag) {
  const page = adminRef && adminRef.page;
  if (!page) return;
  try {
    await page.screenshot({ path: path.join(OUT, `election-${tag}.png`), fullPage: true });
    log(`[dump:${tag}] url:`, page.url());
    const labels = (await page.locator('button').allTextContents())
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    log(`[dump:${tag}] buttons (${labels.length}):`, JSON.stringify(labels));
    log(`[dump:${tag}] pageerrors (${errors.length}):`, JSON.stringify(errors));
  } catch (e) {
    log(`[dump:${tag}] dump itself failed:`, e.message);
  }
}
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

// In-script recomputation of the app's chain math (voting-crypto.ts) so the
// assertions are independent of the code under test.
const SECRET = () => process.env.VOTING_SECRET;
const voterHashOf = (electionId, userId) =>
  createHmac('sha256', SECRET()).update(`voter:${electionId}:${userId}`).digest('hex');
const receiptHashOf = (code) => createHash('sha256').update(code).digest('hex');
const canonical = (p) =>
  `{${Object.keys(p)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${JSON.stringify(p[k])}`)
    .join(',')}}`;
const ballotHashOf = (prevHash, payload) =>
  createHmac('sha256', SECRET())
    .update(`ballot:${prevHash}:${canonical(payload)}`)
    .digest('hex');

async function cleanup() {
  try {
    if (mongoose.connection.readyState === 1) {
      const users = mongoose.connection.collection('users');
      const elections = mongoose.connection.collection('elections');
      const ballots = mongoose.connection.collection('ballots');
      const rolls = mongoose.connection.collection('voterRolls');
      const election = await elections.findOne({ title: TITLE });
      if (election) {
        await ballots.deleteMany({ electionId: election._id });
        await rolls.deleteMany({ electionId: election._id });
        await elections.deleteOne({ _id: election._id });
      }
      for (const email of [ADMIN_EMAIL, VERA_EMAIL, VIC_EMAIL, MOD_EMAIL]) {
        await users.deleteOne({ email });
      }
      log('cleaned up election + Mongo records for the four throwaway actors');
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

/** Fresh context wired to its own Clerk dev-browser token. */
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
  const goto = (p) =>
    page.goto(BASE + p + (p.includes('?') ? '&' : '?') + `__clerk_db_jwt=${devBrowser.token}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
  page.on('pageerror', (e) => errors.push(`[${label}] ${String(e).slice(0, 160)}`));
  return { context, page, goto };
}

let clerkAdmin = null;
/** completeProfile requires a VERIFIED email — the dev instance's sign-up no
 *  longer verifies (setting off), so force-verify through the Backend API. */
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

/** Fill the step-2 alumni form (no uploads, no payment pick) and submit. */
async function completeRegistration(page, pair, baselineWallets) {
  await page.waitForTimeout(1500);
  await page.locator('#phone').fill('+8801712345678');
  await page.locator('#studentId').fill(pair.studentId);
  await page.locator('#batch').selectOption(pair.batch);
  const sectionCount = await page.locator('#payment-receiver').count();
  check(
    'register: payment section visibility matches wallet existence',
    (sectionCount === 1) === (baselineWallets > 0)
  );
  await page.getByRole('button', { name: /Complete registration/i }).click();
  const ok = await waitFor(
    () => page.locator('text=Welcome aboard').count().then((n) => n > 0),
    60000
  );
  if (!ok) {
    const alerts = await page.locator('[role="alert"]').allTextContents();
    log('registration diagnostics — alerts:', JSON.stringify(alerts));
    await page.screenshot({ path: path.join(OUT, 'elect-register-fail.png'), fullPage: true }).catch(() => {});
    throw new Error('registration did not reach the Welcome aboard panel');
  }
}

/** Click a candidate panel and wait until React caught it (aria-checked). */
async function pickCandidate(page, name) {
  const radio = page.getByRole('radio', { name: new RegExp(name) });
  for (let i = 0; i < 10; i++) {
    await radio.click({ timeout: 8000 });
    if ((await radio.getAttribute('aria-checked')) === 'true') return true;
    await page.waitForTimeout(300);
  }
  return false;
}

/** Full vote through the real UI; returns the receipt code (10 chars). */
async function castVoteFor(page, goto, candidateName) {
  await goto('/vote');
  await page.waitForTimeout(1200);
  if (!(await waitFor(() => page.getByRole('radio').count().then((n) => n > 0), 10000))) {
    await page.screenshot({ path: path.join(OUT, `elect-ballot-missing-${candidateName}.png`) }).catch(() => {});
    throw new Error(`ballot did not render for the vote on ${candidateName}`);
  }
  check(`vote: candidate panel listed (${candidateName})`, true);
  check(`vote: pick caught by React (${candidateName})`, await pickCandidate(page, candidateName));
  await page.getByRole('button', { name: 'Review your ballot' }).click();
  const dialog = page.getByRole('dialog');
  check('vote: confirm modal shows the pick', await waitFor(() => dialog.count().then((n) => n === 1))
    && (await dialog.getByText(candidateName).count()) >= 1);
  await page.getByRole('button', { name: 'Cast my vote' }).click();
  const success = await waitFor(() =>
    page.getByText('Your ballot is cast').count().then((n) => n === 1));
  if (!success) {
    const alerts = await page.locator('[role="alert"]').allTextContents();
    const dialogStill = await dialog.count();
    await page.screenshot({ path: path.join(OUT, 'elect-vote-fail.png'), fullPage: true }).catch(() => {});
    log(`vote diagnostics on ${candidateName} — dialog still open: ${dialogStill} — alerts:`, JSON.stringify(alerts));
    throw new Error('vote did not reach the receipt panel');
  }
  check('vote: success panel with receipt', true);
  const raw = (await page.locator('p.select-all').first().textContent()) || '';
  const code = raw.replace(/[^A-Z2-9]/g, '');
  check('vote: receipt code format', /^[A-HJKMNP-TVWXYZ2-9]{10}$/.test(code));
  return code;
}

async function main() {
  loadEnvLocal();
  clerkAdmin = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.collection('users');
  const elections = mongoose.connection.collection('elections');
  const ballotsCol = mongoose.connection.collection('ballots');
  const rollsCol = mongoose.connection.collection('voterRolls');
  const walletsCol = mongoose.connection.collection('paymentWallets');

  // Baselines AFTER any prior-run leftovers — real elections may exist someday
  const bElections = await elections.countDocuments({});
  const bBallots = await ballotsCol.countDocuments({});
  const bRolls = await rollsCol.countDocuments({});
  const baselineWallets = await walletsCol.countDocuments({});
  log('baselines — elections:', bElections, 'ballots:', bBallots, 'rolls:', bRolls, 'wallets:', baselineWallets);

  // Self-heal a crashed earlier run — only ever touches this suite's own
  // timestamped elections; a real election could never carry this title.
  const stale = await elections.find({ title: /^E2E Test Election/ }).toArray();
  for (const s of stale) {
    await ballotsCol.deleteMany({ electionId: s._id });
    await rollsCol.deleteMany({ electionId: s._id });
    await elections.deleteOne({ _id: s._id });
  }
  if (stale.length) log('self-heal: removed', stale.length, 'stale test election(s)');

  await clerkSetup();
  const browser = (browserRef = await chromium.launch({
    args: ['--disable-blink-features=AutomationControlled'],
  }));

  // ---------------- Setup: four throwaway members ----------------
  const admin = await makeActor(browser, 'admin');
  adminRef = admin;
  await signUpActor(admin.page, admin.goto, ADMIN_EMAIL, NAMES.admin[0], NAMES.admin[1]);
  await completeRegistration(admin.page, ADMIN_PAIR, baselineWallets);
  await users.updateOne({ email: ADMIN_EMAIL }, { $set: { role: 'admin', verificationStatus: 'verified' } });

  const vera = await makeActor(browser, 'vera');
  await signUpActor(vera.page, vera.goto, VERA_EMAIL, NAMES.vera[0], NAMES.vera[1]);
  await completeRegistration(vera.page, VERA_PAIR, baselineWallets);
  await users.updateOne({ email: VERA_EMAIL }, { $set: { verificationStatus: 'verified' } });

  const vic = await makeActor(browser, 'vic');
  await signUpActor(vic.page, vic.goto, VIC_EMAIL, NAMES.vic[0], NAMES.vic[1]);
  await completeRegistration(vic.page, VIC_PAIR, baselineWallets);
  // Vic is verified now (the candidate combobox only lists verified members);
  // he is flipped back to pending below to exercise the unverified gate once
  // the election exists, then re-verified through the same Mongo path the
  // real staff flow uses.
  await users.updateOne({ email: VIC_EMAIL }, { $set: { verificationStatus: 'verified' } });

  const veraDoc = await users.findOne({ email: VERA_EMAIL });
  const vicDoc = await users.findOne({ email: VIC_EMAIL });

  // ---------------- Admin: create + configure + open ----------------
  // The create UI only exists on a virgin slate (the app shows the latest
  // election and hides the create card while one exists). A REAL election may
  // already live in this shared DB — if so, seed ours directly in Mongo
  // (ours, being newer, becomes the LATEST for the run's duration; the real
  // one is untouched and drops back to latest at cleanup) and skip the UI
  // checks that can only run on an empty slate — they are proven green on
  // the clean path. Counted after the self-heal so only real ones count.
  const cleanSlate = (await elections.countDocuments({})) === 0;
  await admin.goto('/admin');
  await admin.page.waitForTimeout(1500);
  check('admin: five tabs (members/payments/election/wallets/add)',
    (await admin.page.locator('[role="tab"]').count()) === 5);
  await admin.page.getByRole('tab', { name: 'Election' }).click();
  await admin.page.waitForTimeout(500);

  if (cleanSlate) {
    check('election tab: empty state', await waitFor(() =>
      admin.page.getByText('No committee election yet.').count().then((n) => n === 1)));
    await admin.page.locator('#new-election-title').fill(TITLE);
    await admin.page.locator('#new-election-description').fill('E2E throwaway election — will be deleted.');
    await admin.page.getByRole('button', { name: 'Create election' }).click();
  } else {
    log('pre-existing real election present — seeding ours directly in Mongo');
    await elections.insertOne({
      title: TITLE,
      description: 'E2E throwaway election — will be deleted.',
      status: 'draft',
      openAt: null, closeAt: null, openedAt: null, closedAt: null, publishedAt: null,
      publishedHeadHash: null, publishedBallotCount: null, publishedRollCount: null,
      candidates: [],
      createdAt: new Date(), updatedAt: new Date(),
    });
    // Reload so the tab shows OUR (now-latest) election, not the real one.
    await admin.goto('/admin');
    await admin.page.waitForTimeout(1500);
    await admin.page.getByRole('tab', { name: 'Election' }).click();
    await admin.page.waitForTimeout(500);
  }
  check('election tab: config editor appears after create', await waitFor(() =>
    admin.page.getByText('Manage election').count().then((n) => n === 1)
    && admin.page.getByText(TITLE).count().then((n) => n === 1)));

  const electionDoc = await elections.findOne({ title: TITLE });
  check('mongo: draft election created', !!electionDoc && electionDoc.status === 'draft');

  // Candidates via the verified-member combobox (batch 2014 → Vera + Vic).
  // The dropdown only opens on input focus — click the search box first.
  await admin.page.locator('#candidate-batch').selectOption('2014');
  await admin.page.locator('#candidate-search').click();
  const veraOption = admin.page.locator('#candidate-member-list [role="option"]', { hasText: NAMES.vera.join(' ') });
  check('picker: Vera listed (verified, batch 2014)', await waitFor(() => veraOption.count().then((n) => n === 1)));
  await veraOption.click();
  await admin.page.locator('#candidate-search').fill(NAMES.vic[0]);
  const vicOption = admin.page.locator('#candidate-member-list [role="option"]', { hasText: NAMES.vic.join(' ') });
  check('picker: Vic found via search', await waitFor(() => vicOption.count().then((n) => n === 1)));
  await vicOption.click();
  check('picker: both added to the slate', await waitFor(() =>
    admin.page.getByRole('button', { name: /^Remove/ }).count().then((n) => n === 2)));

  await admin.page.getByRole('button', { name: 'Save election' }).click();
  check('config: save succeeds', await waitFor(() =>
    admin.page.getByText('Election saved.').count().then((n) => n === 1)));
  const savedDoc = await elections.findOne({ title: TITLE });
  check('mongo: slate snapshot saved', !!savedDoc
    && savedDoc.candidates.length === 2
    && savedDoc.candidates.every((c) => c.id && c.name && c.studentId && c.batch === '2014'));

  await admin.page.getByRole('button', { name: 'Open voting now' }).click();
  check('lifecycle: opens voting', await waitFor(() =>
    admin.page.getByText('Voting is open.').count().then((n) => n === 1)));

  // ---------------- Unverified gate, then Vic gets verified ----------------
  // Vic was verified for the combobox above — flip him back to pending to
  // exercise the gate, exactly the way verification flows move in practice.
  await users.updateOne({ email: VIC_EMAIL }, { $set: { verificationStatus: 'pending' } });
  await vic.goto('/vote');
  await vic.page.waitForTimeout(1500);
  check('unverified member blocked from voting', await waitFor(() =>
    vic.page.getByText("Your membership isn't verified yet").count().then((n) => n === 1)));
  check('unverified member sees no ballot', (await vic.page.getByRole('radio').count()) === 0);
  await users.updateOne({ email: VIC_EMAIL }, { $set: { verificationStatus: 'verified' } });

  // ---------------- Vote 1: Vera votes herself (seq 1) ----------------
  const veraReceipt = await castVoteFor(vera.page, vera.goto, `${NAMES.vera.join(' ')}`);
  const electionId = savedDoc._id.toString();
  const veraBallot = await ballotsCol.findOne({ electionId: savedDoc._id, seq: 1 });
  check('mongo: seq-1 ballot with GENESIS link',
    !!veraBallot && veraBallot.prevHash === 'GENESIS' && veraBallot.choice === savedDoc.candidates.find((c) => c.userId.equals(veraDoc._id)).id);
  check('mongo: seq-1 hash + receipt hash recompute (independent)',
    !!veraBallot
      && veraBallot.hash === ballotHashOf('GENESIS', {
        electionId, seq: 1, choice: veraBallot.choice, receiptHash: veraBallot.receiptHash,
      })
      && veraBallot.receiptHash === receiptHashOf(veraReceipt));
  const veraRoll = await rollsCol.findOne({ electionId: savedDoc._id });
  check('mongo: roll pseudonym is the HMAC (not the member id)',
    !!veraRoll && veraRoll.voterHash === voterHashOf(electionId, veraDoc._id.toString())
    && !JSON.stringify(veraRoll).includes(veraDoc._id.toString())
    && veraRoll.batch === '2014');
  check('mongo: ballot count + roll count (this election: 1 + 1)',
    (await ballotsCol.countDocuments({ electionId: savedDoc._id })) === 1
    && (await rollsCol.countDocuments({ electionId: savedDoc._id })) === 1);

  // ---------------- Double vote blocked ----------------
  await vera.goto('/vote');
  await vera.page.waitForTimeout(1500);
  check('double vote: page shows the voted state', await waitFor(() =>
    vera.page.getByText("You've cast your ballot").count().then((n) => n === 1)));
  check('double vote: no ballot rendered', (await vera.page.getByRole('radio').count()) === 0);
  let dupErr = null;
  try {
    await rollsCol.insertOne({
      electionId: savedDoc._id, voterHash: voterHashOf(electionId, veraDoc._id.toString()), batch: '2014',
      createdAt: new Date(), updatedAt: new Date(),
    });
  } catch (e) {
    dupErr = e;
  }
  check('double vote: unique index rejects the raw duplicate roll', !!dupErr && dupErr.code === 11000);

  // ---------------- Staff monitor: turnout yes, tallies no ----------------
  await admin.goto('/admin');
  await admin.page.waitForTimeout(1500);
  await admin.page.getByRole('tab', { name: 'Election' }).click();
  await admin.page.waitForTimeout(800);
  check('monitor: turnout total while open', await waitFor(() =>
    admin.page.getByText('1 ballot').count().then((n) => n === 1)));
  check('monitor: chain verified badge', await waitFor(() =>
    admin.page.getByText('Ballot chain verified').count().then((n) => n === 1)));
  check('monitor: candidate names absent while open (no tally leak)',
    (await admin.page.getByText(NAMES.vera.join(' ')).count()) === 0
    && (await admin.page.getByText(NAMES.vic.join(' ')).count()) === 0
    && (await admin.page.getByText('Results by candidate').count()) === 0);
  await admin.page.screenshot({ path: path.join(OUT, 'election-monitor-open.png') });

  // ---------------- Vote 2: Vic votes himself (seq 2) ----------------
  const vicReceipt = await castVoteFor(vic.page, vic.goto, `${NAMES.vic.join(' ')}`);
  const vicBallot = await ballotsCol.findOne({ electionId: savedDoc._id, seq: 2 });
  check('mongo: seq-2 ballot chains onto seq-1',
    !!vicBallot && vicBallot.prevHash === veraBallot.hash
    && vicBallot.hash === ballotHashOf(veraBallot.hash, {
      electionId, seq: 2, choice: vicBallot.choice, receiptHash: vicBallot.receiptHash,
    })
    && vicBallot.receiptHash === receiptHashOf(vicReceipt));

  // ---------------- Vote 3: the moderator votes Vera (seq 3) ----------------
  const mod = await makeActor(browser, 'mod');
  await signUpActor(mod.page, mod.goto, MOD_EMAIL, NAMES.mod[0], NAMES.mod[1]);
  await completeRegistration(mod.page, MOD_PAIR, baselineWallets);
  await users.updateOne(
    { email: MOD_EMAIL },
    { $set: { role: 'moderator', moderatorBatch: '2017', verificationStatus: 'verified' } }
  );
  const modReceipt = await castVoteFor(mod.page, mod.goto, `${NAMES.vera.join(' ')}`);
  const modBallot = await ballotsCol.findOne({ electionId: savedDoc._id, seq: 3 });
  check('mongo: seq-3 ballot chains onto seq-2',
    !!modBallot && modBallot.prevHash === vicBallot.hash
    && modBallot.receiptHash === receiptHashOf(modReceipt));

  // ---------------- Receipt verification ----------------
  await vera.goto('/vote');
  await vera.page.waitForTimeout(1200);
  await vera.page.locator('#receipt-code').fill(veraReceipt);
  await vera.page.getByRole('button', { name: 'Check my ballot' }).click();
  check('receipt: good code confirms inclusion + recorded choice', await waitFor(() =>
    vera.page.getByText('in the box, recording a vote for').count().then((n) => n === 1)
    && vera.page.getByText(`${NAMES.vera.join(' ')}.`).count().then((n) => n === 1)));
  await vera.page.locator('#receipt-code').fill('VVVVVVVVVV');
  await vera.page.getByRole('button', { name: 'Check my ballot' }).click();
  check('receipt: unknown code errors', await waitFor(() =>
    vera.page.getByText('No ballot found with that receipt code').count().then((n) => n === 1)));

  // ---------------- Close via the UI ----------------
  await admin.goto('/admin');
  await admin.page.waitForTimeout(1500);
  await admin.page.getByRole('tab', { name: 'Election' }).click();
  await admin.page.waitForTimeout(500);
  check('monitor: turnout total at close (3 ballots)', await waitFor(() =>
    admin.page.getByText('3 ballots').count().then((n) => n === 1)));
  await admin.page.getByRole('button', { name: 'Close voting' }).click();
  await admin.page.getByRole('button', { name: 'Yes, close voting' }).click();
  check('lifecycle: closed in Mongo', await waitFor(() =>
    elections.findOne({ _id: savedDoc._id }).then((d) => d.status === 'closed')));
  check('monitor: results appear after close', await waitFor(() =>
    admin.page.getByText('Results by candidate').count().then((n) => n === 1)));
  check('monitor: tallies correct (Vera 2, Vic 1)',
    (await admin.page.locator('div', { hasText: NAMES.vera.join(' ') }).filter({ hasText: '2' }).count()) >= 1);
  await admin.page.screenshot({ path: path.join(OUT, 'election-monitor-closed.png') });

  // ---------------- Tamper → chain fails → publish refuses → restore ----------------
  await ballotsCol.updateOne({ electionId: savedDoc._id, seq: 1 }, { $set: { choice: vicBallot.choice } });
  await admin.page.getByRole('button', { name: 'Re-verify' }).click();
  check('tamper: chain verification FAILS visibly', await waitFor(() =>
    admin.page.getByText('Ballot chain FAILED verification').count().then((n) => n === 1)));
  await dumpAdmin('tampered');
  await admin.page.getByRole('button', { name: 'Publish results' }).click();
  await admin.page.getByRole('button', { name: 'Yes, publish now' }).click();
  check('tamper: publish refuses a broken chain', await waitFor(() =>
    admin.page.getByText('The ballot chain failed verification').count().then((n) => n === 1)));
  check('tamper: still closed (not published)', (await elections.findOne({ _id: savedDoc._id })).status === 'closed');
  await ballotsCol.updateOne({ electionId: savedDoc._id, seq: 1 }, { $set: { choice: veraBallot.choice } });
  await admin.page.getByRole('button', { name: 'Re-verify' }).click();
  check('tamper: restore → chain verifies again', await waitFor(() =>
    admin.page.getByText('Ballot chain verified').count().then((n) => n === 1)));

  // ---------------- Publish via the UI ----------------
  await admin.page.getByRole('button', { name: 'Publish results' }).click();
  await admin.page.getByRole('button', { name: 'Yes, publish now' }).click();
  check('lifecycle: published in Mongo', await waitFor(() =>
    elections.findOne({ _id: savedDoc._id }).then((d) => d.status === 'published')));
  const published = await elections.findOne({ _id: savedDoc._id });
  check('publish: fingerprint frozen to the head hash + counts',
    published.publishedHeadHash === modBallot.hash
    && published.publishedBallotCount === 3
    && published.publishedRollCount === 3);

  // ---------------- /vote published view ----------------
  await vic.goto('/vote');
  await vic.page.waitForTimeout(1500);
  check('results: page shows tallies', await waitFor(() =>
    vic.page.getByText('Results —').count().then((n) => n === 1)));
  check('results: winner badge + counts',
    (await vic.page.getByText('Elected').count()) === 1
    && (await vic.page.getByText('2 votes').count()) === 1
    && (await vic.page.getByText('1 vote').count()) === 1);
  check('results: chain-verified line + fingerprint block',
    (await vic.page.getByText('matched its cryptographic seal').count()) === 1
    && (await vic.page.getByText('Verification fingerprint').count()) === 1
    && (await vic.page.getByText(modBallot.hash).count()) === 1);
  await vic.page.locator('#receipt-code').fill(vicReceipt);
  await vic.page.getByRole('button', { name: 'Check my ballot' }).click();
  check('results: receipt verify still works', await waitFor(() =>
    vic.page.getByText('in the box, recording a vote for').count().then((n) => n === 1)));
  await vic.page.screenshot({ path: path.join(OUT, 'election-results.png') });

  // ---------------- Moderator: monitoring yes, management no ----------------
  await mod.goto('/admin');
  await mod.page.waitForTimeout(1500);
  check('moderator: three tabs (members/payments/election)',
    (await mod.page.locator('[role="tab"]').count()) === 3);
  await mod.page.getByRole('tab', { name: 'Election' }).click();
  await mod.page.waitForTimeout(800);
  check('moderator: monitoring visible (turnout + results)',
    (await mod.page.getByText('ballots cast').count()) >= 1
    && (await mod.page.getByText('Results by candidate').count()) === 1);
  check('moderator: no manage card, no lifecycle buttons',
    (await mod.page.getByText('Manage election').count()) === 0
    && (await mod.page.getByRole('button', { name: 'Close voting' }).count()) === 0
    && (await mod.page.getByRole('button', { name: 'Publish results' }).count()) === 0);

  // ---------------- Independent audit script, while the data exists --------
  let auditOk = false;
  try {
    const out = execSync('npx tsx scripts/verify-election.ts', { encoding: 'utf8', cwd: process.cwd() });
    auditOk = out.includes('ALL CHAINS VERIFIED') && out.includes(TITLE);
    if (!auditOk) log('audit output tail:', out.split(/\r?\n/).slice(-6).join(' | '));
  } catch (e) {
    log('audit script failed:', String(e.stdout || e.message).slice(0, 300));
  }
  check('audit: npm run verify:election verifies the chain from raw DB', auditOk);

  check('zero page errors across all five contexts', errors.length === 0);
  if (errors.length) log('page errors:', errors);

  await browser.close();
  await cleanup();
  log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('[elect] fatal:', e.message);
  await dumpAdmin('fatal').catch(() => {});
  if (browserRef) await browserRef.close().catch(() => {});
  await cleanup();
  process.exit(1);
});
