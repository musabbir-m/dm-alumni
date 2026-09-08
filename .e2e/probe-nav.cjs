/* Workarounds for the Secure-cookie handshake loop on http://localhost:
 * A) create a dev browser (POST /v1/dev_browser), context.addCookies() it
 * B) pass __clerk_db_jwt as a URL param (url_based_session_syncing: true) */
const { chromium } = require('playwright');

const FAPI = 'https://evident-ocelot-8419.clerk.accounts.dev';

(async () => {
  const db = await fetch(`${FAPI}/v1/dev_browser`, { method: 'POST' });
  const dbj = await db.json();
  console.log('dev_browser create:', db.status, dbj.id, 'token?', !!dbj.token);
  const dvb = dbj.token;

  const browser = await chromium.launch();

  // A: seeded cookie
  {
    const context = await browser.newContext();
    await context.addCookies([
      { name: '__clerk_db_jwt', value: dvb, url: 'http://localhost:3000' },
      { name: '__client_uat', value: '0', url: 'http://localhost:3000' },
    ]);
    const page = await context.newPage();
    try {
      await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 20000 });
      console.log('A (seeded cookie) OK — url:', page.url(), '| title:', await page.title());
    } catch (e) {
      console.log('A (seeded cookie) FAIL:', e.message.split('\n')[0]);
    }
    await context.close();
  }

  // B: URL param
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(`http://localhost:3000/?__clerk_db_jwt=${dvb}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      console.log('B (url param) OK — url:', page.url(), '| title:', await page.title());
      const cookies = await context.cookies('http://localhost:3000');
      console.log('  cookies after B:', cookies.map((c) => c.name).join(', ') || 'none');
    } catch (e) {
      console.log('B (url param) FAIL:', e.message.split('\n')[0]);
    }
    await context.close();
  }

  await browser.close();
})().catch((e) => { console.error('probe fatal:', e.message); process.exit(1); });
