/**
 * Saves your most recent job-alert emails as private test fixtures, and shows what the parser
 * extracts from each. Use it when a site changes its email layout and jobs stop appearing.
 *
 *   npm run gmail:sample            (5 newest alert emails)
 *   npm run gmail:sample -- 20
 *
 * Files go to pipeline/test/fixtures/private/, which is git-ignored: they contain your inbox.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfigLoose } from './loose-config.js';
import { GmailClient, header, messageHtml } from '../collectors/gmail/client.js';
import { alertQuery } from '../collectors/gmail/index.js';
import { parseAlertEmail } from '../collectors/gmail/parsers.js';

async function main() {
  const env = loadConfigLoose();
  if (!env.GMAIL_CLIENT_ID || !env.GMAIL_CLIENT_SECRET || !env.GMAIL_REFRESH_TOKEN) {
    console.error('Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN first (npm run gmail:auth).');
    process.exit(1);
  }
  const count = Number(process.argv[2] ?? 5);
  const gmail = new GmailClient({ clientId: env.GMAIL_CLIENT_ID, clientSecret: env.GMAIL_CLIENT_SECRET, refreshToken: env.GMAIL_REFRESH_TOKEN });
  const dir = join(dirname(fileURLToPath(import.meta.url)), '../../test/fixtures/private');
  await mkdir(dir, { recursive: true });

  for (const id of await gmail.listMessageIds(alertQuery(14), count)) {
    const msg = await gmail.getMessage(id);
    const from = header(msg, 'From');
    const html = messageHtml(msg);
    const parsed = parseAlertEmail(from, html, null, id);
    const file = join(dir, `${id}.html`);
    await writeFile(file, `<!-- From: ${from.replace(/-->/g, '')} -->\n${html}`);
    console.log(`\n${from}\n  saved ${file}`);
    for (const j of parsed?.jobs ?? []) console.log(`  - ${j.title} | ${j.company ?? '?'} | ${j.location ?? '?'} | ${j.url}`);
    if (!parsed?.jobs.length) console.log('  (no jobs found: this is the email to tune the parser with)');
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
