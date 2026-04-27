/**
 * One-shot: call production /admin/n8n/active-journeys with N8N_API_TOKEN from .env
 * Run: node scripts/verify-n8n-prod.mjs
 * Does not print the token.
 */
import 'dotenv/config';

const url = 'https://oliecare.cloud/api/v1/admin/n8n/active-journeys';
const token = process.env.N8N_API_TOKEN;

if (!token) {
  console.error(
    'N8N_API_TOKEN is not set. Add it to .env or run: N8N_API_TOKEN=... node scripts/verify-n8n-prod.mjs\n' +
      'Use the same value as GitHub secret N8N_API_TOKEN (Repository settings → Secrets), not a random local token.'
  );
  process.exit(1);
}

const res = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` },
});
const text = await res.text();
let parsed;
try {
  parsed = JSON.parse(text);
} catch {
  parsed = { raw: text.slice(0, 200) };
}

const count = Array.isArray(parsed.data) ? parsed.data.length : 0;
console.log('HTTP', res.status, res.statusText);
if (res.ok) {
  console.log('OK — active journeys returned:', count);
} else {
  console.log('FAIL —', parsed.message || parsed);
}

process.exit(res.ok ? 0 : 1);
