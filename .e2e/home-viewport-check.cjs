// Decisive check: viewport-only screenshots (no stitching) inside #contributors
// plus a dump of every fixed/sticky element — distinguishes a real floating
// widget from Playwright element-screenshot stitching artifacts.
// GET-only against the public homepage. Usage: node .e2e/home-viewport-check.cjs
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  for (const vp of [
    { name: 'mobile', width: 375, height: 800 },
    { name: 'desktop', width: 1280, height: 900 },
  ]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    page.on('pageerror', (e) => errors.push(`${vp.name}: ${e}`));
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.locator('#contributors').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);

    // every fixed/sticky element on the page (what could legitimately overlay)
    const stickies = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('body *').forEach((el) => {
        const p = getComputedStyle(el).position;
        if ((p === 'fixed' || p === 'sticky') && el.getBoundingClientRect().height > 0) {
          out.push(`${p} <${el.tagName.toLowerCase()} class="${String(el.className).split(' ').slice(0, 3).join(' ')}">`);
        }
      });
      return out;
    });
    console.log(`[${vp.name}] fixed/sticky: ${JSON.stringify(stickies)}`);

    // walk the section in one-viewport steps, capturing plain viewport shots
    const steps = await page.evaluate(() => {
      const sec = document.querySelector('#contributors');
      const top = sec.getBoundingClientRect().top + window.scrollY;
      const bottom = top + sec.offsetHeight;
      const h = window.innerHeight;
      const list = [];
      for (let y = top; y < bottom; y += h * 0.8) list.push(Math.floor(y));
      return list;
    });
    for (let i = 0; i < steps.length; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), steps[i]);
      await page.waitForTimeout(350);
      await page.screenshot({ path: `.e2e/artifacts/home-contributors-${vp.name}-vp${i}.png` });
    }
    console.log(`[${vp.name}] ${steps.length} viewport shots`);
    await page.close();
  }

  await browser.close();
  if (errors.length) {
    console.log('PAGE ERRORS:', errors);
    process.exit(1);
  }
  console.log('done');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
