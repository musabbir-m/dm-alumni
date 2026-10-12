// Visual check for the homepage Contributors section (GET-only, public page).
// Usage: node .e2e/home-check.cjs   (E2E_BASE overrides http://localhost:3000)
// Captures the whole #contributors element at desktop + mobile and scans the
// section for horizontal overflow at 375px. Exits 1 on page errors/overflow.
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const section = page.locator('#contributors');
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200); // let reveal animations settle
  await section.screenshot({ path: '.e2e/artifacts/home-contributors-desktop.png' });
  console.log('desktop screenshot ok');

  const mobile = await browser.newPage({ viewport: { width: 375, height: 800 } });
  mobile.on('pageerror', (e) => errors.push(String(e)));
  await mobile.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await mobile.locator('#contributors').scrollIntoViewIfNeeded();
  await mobile.waitForTimeout(1200);
  await mobile.locator('#contributors').screenshot({ path: '.e2e/artifacts/home-contributors-mobile.png' });
  console.log('mobile screenshot ok');

  // Horizontal overflow scan inside the section at 375px
  const offenders = await mobile.evaluate(() => {
    const iw = window.innerWidth;
    const bad = [];
    document.querySelectorAll('#contributors *').forEach((el) => {
      if (el.closest('.pointer-events-none')) return;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > iw + 1) {
        bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} right=${Math.round(r.right)}`);
      }
    });
    return bad;
  });
  if (offenders.length) {
    console.log(`OVERFLOW at 375px (${offenders.length}):`);
    offenders.slice(0, 20).forEach((o) => console.log('  ' + o));
  } else {
    console.log('no horizontal overflow at 375px');
  }

  await browser.close();
  if (errors.length) {
    console.log('PAGE ERRORS:', errors);
    process.exit(1);
  }
  if (offenders.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
