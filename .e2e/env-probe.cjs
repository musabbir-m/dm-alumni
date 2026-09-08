/* Fetch the Clerk FAPI environment config with the publishable key and print
 * the non-secret parts relevant to the no-POST sign-up hang (captcha/attack
 * protection). Never prints the key itself. */
const fs = require('fs');

const FAPI = 'https://evident-ocelot-8419.clerk.accounts.dev';

function pkFromEnvLocal() {
  const raw = fs.readFileSync('.env.local', 'utf8');
  const m = raw.match(/^\s*NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY\s*=\s*(pk_[^\s"']+)/m);
  if (!m) throw new Error('publishable key not found in .env.local');
  return m[1];
}

(async () => {
  const pk = pkFromEnvLocal();
  const res = await fetch(`${FAPI}/v1/environment`, {
    headers: { Authorization: `Bearer ${pk}` },
  });
  const body = await res.text();
  console.log('status:', res.status, 'bytes:', body.length);
  const s = body;
  for (const key of ['captcha', 'attack_protection', 'turnstile', 'hcaptcha', 'friendly', 'bot']) {
    const hits = [];
    let i = -1;
    while ((i = s.toLowerCase().indexOf(key, i + 1)) !== -1 && hits.length < 3) {
      hits.push(s.slice(Math.max(0, i - 60), i + 160).replace(/\s+/g, ' '));
    }
    console.log(`\n[${key}] ${hits.length ? '' : 'absent'}`);
    hits.forEach((h) => console.log('  …' + h + '…'));
  }
  // auth_config in full (config only — no secrets in the environment response)
  try {
    const j = JSON.parse(s);
    const ac = j.auth_config ?? j.response?.auth_config;
    if (ac) console.log('\nauth_config:', JSON.stringify(ac, null, 2));
  } catch (e) {
    console.log('parse failed:', e.message);
  }
})().catch((e) => {
  console.error('probe failed:', e.message);
  process.exitCode = 1;
});
