/* Mobile-viewport responsiveness probe for the auth surfaces:
 *   - /sign-in and /sign-up (public — direct loads)
 *   - /register (step 2 — needs a session: full +clerk_test sign-up dance,
 *     OTP 424242, measured BEFORE any form submit, so no Mongo record is
 *     ever created; the throwaway Clerk dev user stays, harness precedent)
 * For each route x viewport it reports page-level horizontal overflow, the
 * .cl-card geometry, and every REAL element whose right edge crosses the
 * viewport — elements inside .pointer-events-none decorative layers are
 * skipped (aurora orbs are clipped by their overflow-hidden parents).
 * Leaves screenshots in .e2e/artifacts/mobile-*.png.
 * Run: node .e2e/mobile-check.cjs  (E2E_BASE overrides, default :3000).
 * REGISTER=0 skips the authenticated /register pass. */
const { chromium } = require('playwright');
const { clerkSetup, setupClerkTestingToken } = require('@clerk/testing/playwright');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const FAPI = 'https://evident-ocelot-8419.clerk.accounts.dev';
const DO_REGISTER = process.env.REGISTER !== '0';

const VIEWPORTS = [
  { width: 320, height: 700 }, // small phone (iPhone SE class)
  { width: 375, height: 700 }, // common phone
  { width: 768, height: 1024 }, // tablet — panels still stacked below lg
];

const measure = () => {
  const iw = window.innerWidth;
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.pointer-events-none')) continue; // decorative layers
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > iw + 1) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.getAttribute('class') || '').slice(0, 110),
        w: Math.round(r.width),
        right: Math.round(r.right),
      });
    }
  }
  const card = document.querySelector('.cl-card');
  return {
    iw,
    scrollW: document.documentElement.scrollWidth,
    hasHScroll: document.documentElement.scrollWidth > iw,
    clCard: card
      ? {
          rectW: Math.round(card.getBoundingClientRect().width),
          rectRight: Math.round(card.getBoundingClientRect().right),
          minWidth: getComputedStyle(card).minWidth,
        }
      : null,
    offenders: offenders.slice(0, 8),
  };
};

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
  await clerkSetup();
  const dbRes = await fetch(`${FAPI}/v1/dev_browser`, { method: 'POST' });
  const devBrowser = await dbRes.json();
  if (!devBrowser.token) throw new Error('could not create Clerk dev browser');
  const DVB = `__clerk_db_jwt=${devBrowser.token}`;

  const browser = await chromium.launch();
  let failures = 0;
  const run = async (label, page) => {
    const report = await page.evaluate(measure);
    const ok = !report.hasHScroll && report.offenders.length === 0;
    if (!ok) failures++;
    console.log(`\n=== ${label} — ${ok ? 'OK' : 'BROKEN'} ===`);
    console.log(JSON.stringify(report, null, 2));
    await page.screenshot({
      path: `.e2e/artifacts/mobile-${label.replace(/[^\w-]+/g, '-')}.png`,
      fullPage: false,
    });
  };

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: vp });
    const page = await context.newPage();
    await setupClerkTestingToken({ page });
    for (const route of ['/sign-in', '/sign-up']) {
      await page.goto(`${BASE}${route}?${DVB}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector('.cl-card', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2500);
      await run(`${vp.width}w ${route}`, page);
    }
    await context.close();
  }

  // Authenticated /register pass at phone width — measure the form, never submit
  if (DO_REGISTER) {
    const EMAIL = `mobchk${Date.now()}+clerk_test@example.com`;
    const context = await browser.newContext({ viewport: { width: 375, height: 700 } });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    const page = await context.newPage();
    await setupClerkTestingToken({ page });
    const goto = (p) =>
      page.goto(`${BASE}${p}?${DVB}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const emailField = 'input[name="identifier"], input[name="emailAddress"]';
    await goto('/sign-up');
    await waitFor(() => page.locator(emailField).count());
    if (await page.locator('input[name="firstName"]').count())
      await page.locator('input[name="firstName"]').fill('Mobi');
    if (await page.locator('input[name="lastName"]').count())
      await page.locator('input[name="lastName"]').fill('Checker');
    await page.locator(emailField).first().fill(EMAIL);
    await page.locator('input[name="password"]').fill('TestPass!2026xyz');
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
    await page.waitForTimeout(2500);
    await run('375w /register', page);
    await context.close();
  }

  await browser.close();
  console.log(failures === 0 ? '\nNO OVERFLOW' : `\n${failures} VIEWPORT(S) OVERFLOWING`);
  process.exitCode = failures ? 1 : 0;
}

main().catch((e) => {
  console.error('[mobile-check] fatal:', e);
  process.exit(1);
});
