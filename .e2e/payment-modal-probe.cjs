/* Focused probe for the payment-details modal — settles a contradiction the
 * full suite left: the 'reopens in dark mode' dialog-count check passed, but
 * the dark screenshot showed no modal. Captures, for light AND dark reload:
 * the live [role=dialog] DOM state (count, rect, computed opacity/display,
 * outerHTML length) immediately beside each screenshot, plus console errors.
 * Throwaway actor only; inserts its own target+wallet via Mongo; cleans up.
 *   npx next start -p 3100  (background)
 *   $env:E2E_BASE='http://localhost:3100'; node .e2e/payment-modal-probe.cjs */
const { chromium } = require('playwright');
const { clerkSetup, setupClerkTestingToken } = require('@clerk/testing/playwright');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const FAPI = 'https://evident-ocelot-8419.clerk.accounts.dev';
const OUT = path.join(__dirname, 'artifacts');
fs.mkdirSync(OUT, { recursive: true });

const PASSWORD = 'TestPass!2026xyz';
const STAMP = Date.now();
const EMAIL = `pmodal${STAMP}+clerk_test@example.com`;
const TARGET = {
  name: 'Zephyr Quillstone',
  email: `pmt${STAMP}+tmp@dm-alumni.local`,
  phone: '+8801799888777',
  studentId: `PMT-${STAMP % 100000}`,
  batch: '2018',
};
const PAIR = { studentId: '1717062', batch: '2018' };
const WALLET_NUM = '01812345678';
const TRX = 'TRX-TGT-4242';

const log = (...a) => console.log('[probe]', ...a);
const consoleErrors = [];

function loadEnvLocal() {
  const raw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

async function waitFor(fn, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function dialogState(page) {
  return page.evaluate(() => {
    const el = document.querySelector('[role="dialog"]');
    if (!el) return { present: false };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const overlay = el.parentElement;
    const ocs = overlay ? getComputedStyle(overlay) : null;
    return {
      present: true,
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      display: cs.display,
      opacity: cs.opacity,
      position: cs.position,
      htmlLen: el.outerHTML.length,
      overlay: ocs
        ? { position: ocs.position, opacity: ocs.opacity, inset: [ocs.top, ocs.left, ocs.bottom, ocs.right] }
        : null,
    };
  });
}

async function capture(page, label) {
  const state = await dialogState(page);
  log(`${label} dialog:`, JSON.stringify(state));
  await page.screenshot({ path: path.join(OUT, `modal-probe-${label}.png`) });
  return state;
}

async function main() {
  loadEnvLocal();
  await mongoose.connect(process.env.MONGODB_URI);
  const users = mongoose.connection.collection('users');
  const walletsCol = mongoose.connection.collection('paymentWallets');

  await clerkSetup();
  const browser = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled'] });
  const dbRes = await fetch(`${FAPI}/v1/dev_browser`, { method: 'POST' });
  const devBrowser = await dbRes.json();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();
  await setupClerkTestingToken({ page });
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => consoleErrors.push(`PAGEERROR ${String(e).slice(0, 200)}`));
  const goto = (p) =>
    page.goto(BASE + p + (p.includes('?') ? '&' : '?') + `__clerk_db_jwt=${devBrowser.token}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

  try {
    // Sign up + register the throwaway admin
    await goto('/sign-up');
    await waitFor(() => page.locator('input[name="identifier"], input[name="emailAddress"]').count());
    if (await page.locator('input[name="firstName"]').count())
      await page.locator('input[name="firstName"]').fill('Ada');
    if (await page.locator('input[name="lastName"]').count())
      await page.locator('input[name="lastName"]').fill('Probell');
    await page
      .locator('input[name="identifier"], input[name="emailAddress"]')
      .first()
      .fill(EMAIL);
    await page.locator('input[name="password"]').fill(PASSWORD);
    const primary = page.locator('button.cl-formButtonPrimary').first();
    if (await primary.count()) await primary.click();
    else await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
    const codeSel = 'input[name="code"], input[autocomplete="one-time-code"]';
    if (await waitFor(() => page.locator(codeSel).count(), 8000)) {
      await page.waitForTimeout(1500);
      await page.locator(codeSel).first().click({ timeout: 5000 }).catch(() => {});
      await page.keyboard.type('424242', { delay: 60 });
      if (!(await waitFor(() => page.url().includes('/register'), 8000))) {
        const cont = page.locator('button.cl-formButtonPrimary:not([disabled])').first();
        if (await waitFor(() => cont.count(), 5000)) await cont.click({ timeout: 10000 }).catch(() => {});
      }
    }
    await page.waitForURL('**/register', { timeout: 45000 });
    await page.waitForTimeout(1500);
    await page.locator('#phone').fill('+8801712345678');
    await page.locator('#studentId').fill(PAIR.studentId);
    await page.locator('#batch').selectOption(PAIR.batch);
    await page.getByRole('button', { name: /Complete registration/i }).click();
    await waitFor(() => page.locator('text=Welcome aboard').count().then((n) => n > 0), 60000);

    // Promote; insert target + wallet + receiver choice directly
    await users.updateOne(
      { email: EMAIL },
      { $set: { role: 'admin', verificationStatus: 'verified' } }
    );
    const ins = await users.insertOne({
      name: TARGET.name, email: TARGET.email, phone: TARGET.phone,
      studentId: TARGET.studentId, batch: TARGET.batch, role: 'alumni',
      verificationStatus: 'pending', clerkId: null, moderatorBatch: null,
      photo: null, docType: null, doc: null,
      createdAt: new Date(), updatedAt: new Date(),
    });
    const wIns = await walletsCol.insertOne({
      userId: ins.insertedId, name: TARGET.name, studentId: TARGET.studentId,
      batch: TARGET.batch, photo: '', walletType: 'nagad', walletNumber: WALLET_NUM,
      createdAt: new Date(), updatedAt: new Date(),
    });
    await users.updateOne(
      { _id: ins.insertedId },
      { $set: { paymentReceiverId: wIns.insertedId, paymentStatus: 'pending', paymentTransactionId: TRX } }
    );
    log('setup done: throwaway admin + target + wallet');

    const infoBtn = () =>
      page
        .locator('li', { hasText: TARGET.name })
        .getByRole('button', { name: `Payment details for ${TARGET.name}` });

    // ---- LIGHT: straight navigation, no reload ----
    await goto('/admin');
    await page.waitForTimeout(1500);
    log('light: info button count =', await infoBtn().count());
    await infoBtn().click();
    const lightOpen = await waitFor(() => page.getByRole('dialog').count().then((n) => n === 1));
    log('light: dialog open =', lightOpen);
    await capture(page, 'light-t0');
    await page.waitForTimeout(600);
    await capture(page, 'light-t600');

    // ---- DARK: emulate + reload, the exact path the suite took ----
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    await page.waitForTimeout(1500);
    log('dark: info button count =', await infoBtn().count());
    await infoBtn().click();
    const darkOpen = await waitFor(() => page.getByRole('dialog').count().then((n) => n === 1));
    log('dark: dialog open =', darkOpen);
    await capture(page, 'dark-t0');
    await page.waitForTimeout(600);
    await capture(page, 'dark-t600');
    await page.waitForTimeout(1500);
    await capture(page, 'dark-t2100');

    log('console/page errors:', consoleErrors.length ? consoleErrors : '(none)');
  } finally {
    const target = await users.findOne({ email: TARGET.email });
    if (target) await walletsCol.deleteMany({ userId: target._id });
    await users.deleteOne({ email: EMAIL });
    await users.deleteOne({ email: TARGET.email });
    log('cleaned up');
    await browser.close().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
}

main().catch((e) => {
  console.error('[probe] fatal:', e.message);
  process.exit(1);
});
