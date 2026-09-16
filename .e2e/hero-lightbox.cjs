/* Browser e2e for the hero lightbox. Run: node .e2e/hero-lightbox.cjs
 * (dev server on :3000 must be running; playwright installed --no-save).
 * The homepage is public — no Clerk dance needed:
 *   - clicking the active hero slide opens the dialog (image + caption)
 *   - Esc closes; the backdrop click closes; the X button closes
 *   - clicking the photo itself keeps it open
 *   - zero page errors */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const OUT = path.join(__dirname, 'artifacts');
fs.mkdirSync(OUT, { recursive: true });

const log = (...a) => console.log('[lbx]', ...a);
let failures = 0;
const check = (name, ok) => {
  log(ok ? `PASS ${name}` : `FAIL ${name}`);
  if (!ok) failures++;
};

async function waitFor(fn, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // The active slide is the only pointer-events-auto one in the stack
  const slide = page.locator('button.cursor-zoom-in.pointer-events-auto');
  await waitFor(() => slide.count());
  // Hover first — pauses the autoplay so `active` can't shift mid-test
  await slide.hover();

  const dialog = page.locator('div[role="dialog"][aria-modal="true"]');
  const closed = () => waitFor(async () => (await dialog.count()) === 0);
  const open = () => waitFor(() => dialog.isVisible());

  // 1. Click the slide → dialog opens with the active photo + caption
  await slide.click();
  check('click opens the lightbox', await open());
  const slideSrc = await slide.locator('img').getAttribute('src');
  const boxSrc = await dialog.locator('img').getAttribute('src');
  check('lightbox shows the active batch photo', !!boxSrc && boxSrc === slideSrc);
  check('caption shows batch + session', (await dialog.textContent()).includes('Session'));
  await page.screenshot({ path: path.join(OUT, 'hero-lightbox.png'), fullPage: false });

  // 2. Esc closes
  await page.keyboard.press('Escape');
  check('Esc closes the lightbox', await closed());

  // 3. Reopen, then a backdrop click (far from the photo) closes
  await slide.click();
  check('reopen works', await open());
  await dialog.click({ position: { x: 12, y: 12 } });
  check('backdrop click closes', await closed());

  // 4. Reopen, close via the X button
  await slide.click();
  await open();
  await dialog.getByRole('button', { name: 'Close photo' }).click();
  check('X button closes', await closed());

  // 5. Clicking the photo itself does NOT close (stopPropagation)
  await slide.click();
  await open();
  await dialog.locator('img').click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
  check('clicking the photo keeps it open', (await dialog.count()) === 1);

  log('page errors seen:', errors.length ? errors : 'none');
  check('zero page errors', errors.length === 0);
  await browser.close();
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exitCode = failures ? 1 : 0;
}

main().catch((e) => {
  console.error('[lbx] fatal:', e);
  process.exit(1);
});
