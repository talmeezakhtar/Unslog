/**
 * One-time helper: signs you in to Google and prints a Gmail refresh token for GMAIL_REFRESH_TOKEN.
 *
 *   npm run gmail:auth            (read-only: collect alert emails)
 *   npm run gmail:auth -- --send  (also allow sending the morning digest to yourself)
 *
 * Needs GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET from a Google Cloud OAuth client of type
 * "Desktop app" (docs/01-getting-started.md, step 4).
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { loadEnv } from '../lib/env.js';

loadEnv();

const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;

async function main() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in your .env first.');
    process.exit(1);
  }
  const scopes = ['https://www.googleapis.com/auth/gmail.readonly'];
  if (process.argv.includes('--send')) scopes.push('https://www.googleapis.com/auth/gmail.send');

  const state = randomBytes(16).toString('hex');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  }).toString();

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const u = new URL(req.url ?? '/', REDIRECT);
      if (u.pathname !== '/callback') {
        res.writeHead(404).end();
        return;
      }
      if (u.searchParams.get('state') !== state) {
        res.writeHead(400).end('State mismatch. Start again.');
        server.close();
        reject(new Error('OAuth state mismatch'));
        return;
      }
      const c = u.searchParams.get('code');
      res.writeHead(200, { 'content-type': 'text/plain' }).end(c ? 'Done. You can close this tab and go back to the terminal.' : 'No code received.');
      server.close();
      c ? resolve(c) : reject(new Error(u.searchParams.get('error') ?? 'no code'));
    });
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`\nOpen this link, sign in with the Gmail account that receives your job alerts:\n\n${url}\n`);
    });
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: REDIRECT, grant_type: 'authorization_code' }),
  });
  const data = (await res.json()) as { refresh_token?: string; error?: string; error_description?: string };
  if (!data.refresh_token) {
    console.error('No refresh token returned:', data.error, data.error_description ?? '');
    process.exit(1);
  }
  console.log('\nAdd this line to your .env (and as a GitHub Actions secret). Keep it private:\n');
  console.log(`GMAIL_REFRESH_TOKEN=${data.refresh_token}\n`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
