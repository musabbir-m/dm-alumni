/* One-off deep inspection of Clerk's injected CSS + geometry on /sign-in at
 * 375px — answers WHY .cl-rootBox/.cl-cardBox exceed their parent.
 * Run: node .e2e/inspect-clerk.cjs */
const { chromium } = require('playwright');

const BASE = process.env.E2E_BASE || 'http://localhost:3000';
const FAPI = 'https://evident-ocelot-8419.clerk.accounts.dev';

async function main() {
  const dbRes = await fetch(`${FAPI}/v1/dev_browser`, { method: 'POST' });
  const devBrowser = await dbRes.json();
  const DVB = `__clerk_db_jwt=${devBrowser.token}`;
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 375, height: 700 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/sign-in?${DVB}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.cl-card', { timeout: 20000 });
  await page.waitForTimeout(2000);

  const out = await page.evaluate(() => {
    const chain = [];
    let el = document.querySelector('.cl-rootBox');
    while (el && el !== document.documentElement) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      chain.push({
        what: (el.getAttribute('class') || el.tagName).slice(0, 90),
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width),
        width: cs.width,
        minWidth: cs.minWidth,
        maxWidth: cs.maxWidth,
        boxSizing: cs.boxSizing,
        display: cs.display,
      });
      el = el.parentElement;
    }
    const rules = [];
    const walk = (ruleList, media) => {
      for (const rule of ruleList) {
        if (rule.cssRules) {
          walk(rule.cssRules, rule.media ? rule.media.mediaText : media);
          continue;
        }
        if (
          rule.selectorText &&
          /cl-rootBox|cl-cardBox|\.cl-card(?!Box)/.test(rule.selectorText)
        ) {
          const w = [rule.style?.width, rule.style?.minWidth, rule.style?.maxWidth]
            .filter(Boolean).join(' / ');
          if (w) rules.push(`${media ? `@media ${media} ` : ''}${rule.selectorText} → w/min/max: ${w}`);
        }
      }
    };
    for (const sheet of document.styleSheets) {
      let list;
      try { list = sheet.cssRules; } catch { continue; }
      if (list) walk(list);
    }
    // Where does the 335px width come from? clerk-js hides its rules from
    // document.styleSheets — check inline styles, adopted (constructed)
    // sheets, and shadow roots.
    const rootBox = document.querySelector('.cl-rootBox');
    const adopted = [];
    const walkSheet = (sheet) => {
      let list;
      try { list = sheet.cssRules; } catch { return; }
      for (const rule of list || []) {
        if (rule.cssRules) { walkSheet({ cssRules: rule.cssRules, cssText: rule.cssText }); continue; }
        if (rule.selectorText && /cl-rootBox|cl-cardBox|\.cl-card(?!Box)/.test(rule.selectorText)) {
          adopted.push(rule.cssText.slice(0, 260));
        }
      }
    };
    for (const sheet of document.adoptedStyleSheets || []) walkSheet(sheet);
    if (rootBox && rootBox.shadowRoot) {
      for (const sheet of rootBox.shadowRoot.adoptedStyleSheets || []) walkSheet(sheet);
    }
    return {
      iw: window.innerWidth,
      chain,
      documentRules: rules,
      inlineStyle: rootBox ? rootBox.getAttribute('style') : null,
      adoptedSheetCount: (document.adoptedStyleSheets || []).length,
      rootBoxHasShadow: !!(rootBox && rootBox.shadowRoot),
      adoptedRules: adopted.slice(0, 12),
    };
  });
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error('[inspect] fatal:', e);
  process.exit(1);
});
