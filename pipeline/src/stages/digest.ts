import type { Config } from '../config.js';
import { GmailClient } from '../collectors/gmail/client.js';
import type { Repo } from '../db/repo.js';
import { request } from '../lib/http.js';
import { errorMessage, log } from '../lib/log.js';
import type { Profile } from '../types.js';

export interface DigestContent {
  jobs: Array<{ id: string; title: string; company: string | null; city: string | null; score: number }>;
  followUps: Array<{ id: string; title: string; company: string | null; appliedAt: Date | null }>;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The morning message as Telegram-flavoured HTML (Telegram supports a small set of tags). */
export function digestTelegram(c: DigestContent, appUrl: string): string {
  const lines = [`<b>Unslog · your morning shortlist</b>`];
  if (c.jobs.length === 0) lines.push('', 'No new strong matches today. Check your filters if this keeps happening.');
  else {
    lines.push('', `<b>Top ${c.jobs.length} jobs</b>`);
    c.jobs.forEach((j, i) =>
      lines.push(
        `${i + 1}. <a href="${esc(`${appUrl}/jobs/${j.id}`)}">${esc(j.title)}</a> · ${esc(j.company ?? 'Unknown company')}${j.city ? ` · ${esc(j.city)}` : ''} — <b>${j.score}</b>`,
      ),
    );
  }
  if (c.followUps.length) {
    lines.push('', `<b>Follow-ups due (${c.followUps.length})</b>`);
    c.followUps.forEach((f) => lines.push(`• ${esc(f.title)} · ${esc(f.company ?? '')}`));
  }
  lines.push('', `<a href="${esc(appUrl)}">Open dashboard</a>`);
  return lines.join('\n');
}

export function digestEmailHtml(c: DigestContent, appUrl: string): string {
  const jobRows = c.jobs
    .map(
      (j) =>
        `<tr><td style="padding:6px 12px 6px 0;font-weight:600">${j.score}</td><td style="padding:6px 0"><a href="${esc(`${appUrl}/jobs/${j.id}`)}">${esc(j.title)}</a><br><span style="color:#555">${esc(j.company ?? 'Unknown company')}${j.city ? ` · ${esc(j.city)}` : ''}</span></td></tr>`,
    )
    .join('');
  const follow = c.followUps.map((f) => `<li>${esc(f.title)} · ${esc(f.company ?? '')}</li>`).join('');
  return `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#1c1c1c">
<h2 style="margin:0 0 12px">Your morning shortlist</h2>
${c.jobs.length ? `<table>${jobRows}</table>` : '<p>No new strong matches today.</p>'}
${c.followUps.length ? `<h3>Follow-ups due</h3><ul>${follow}</ul>` : ''}
<p><a href="${esc(appUrl)}">Open Unslog</a></p></div>`;
}

export async function sendTelegram(botToken: string, chatId: string, html: string): Promise<void> {
  await request(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
}

/** Sends the digest once per day per user, on the channel they picked. */
export async function sendDigest(config: Config, repo: Repo, profile: Profile): Promise<'sent' | 'skipped' | 'failed'> {
  if (profile.digestChannel === 'none') return 'skipped';
  if (await repo.digestSentToday(profile.userId)) return 'skipped';
  const content = await repo.digestData(profile.userId, config.DIGEST_TOP_N, profile.minScore);
  const record = { userId: profile.userId, channel: profile.digestChannel, jobIds: content.jobs.map((j) => j.id), followUpIds: content.followUps.map((f) => f.id) };
  try {
    if (profile.digestChannel === 'telegram') {
      if (!config.TELEGRAM_BOT_TOKEN || !profile.telegramChatId) throw new Error('Telegram needs TELEGRAM_BOT_TOKEN and a chat id in Settings');
      await sendTelegram(config.TELEGRAM_BOT_TOKEN, profile.telegramChatId, digestTelegram(content, config.APP_URL));
    } else {
      if (!config.GMAIL_CLIENT_ID || !config.GMAIL_CLIENT_SECRET || !config.GMAIL_REFRESH_TOKEN || !profile.digestEmail) {
        throw new Error('Email digest needs the Gmail keys (with the send scope) and a digest email in Settings');
      }
      const gmail = new GmailClient({ clientId: config.GMAIL_CLIENT_ID, clientSecret: config.GMAIL_CLIENT_SECRET, refreshToken: config.GMAIL_REFRESH_TOKEN });
      await gmail.sendHtml(profile.digestEmail, `Unslog: ${content.jobs.length} jobs for you today`, digestEmailHtml(content, config.APP_URL));
    }
    await repo.recordDigest(record);
    return 'sent';
  } catch (err) {
    log.warn('digest failed', { user: profile.userId, error: errorMessage(err) });
    await repo.recordDigest({ ...record, error: errorMessage(err).slice(0, 500) });
    return 'failed';
  }
}
