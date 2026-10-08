import { getJson, request } from '../../lib/http.js';

/**
 * Minimal Gmail REST client using OAuth 2.0 with a long-lived refresh token.
 * Get the refresh token once with `npm run gmail:auth` (see docs/01-getting-started.md).
 * Scopes: gmail.readonly to read alerts, gmail.send only if you want the digest by email.
 */

export interface GmailCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface Header {
  name: string;
  value: string;
}
interface Part {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: Part[];
  headers?: Header[];
}
export interface GmailMessage {
  id: string;
  threadId?: string;
  internalDate?: string;
  payload?: Part;
}

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

export class GmailClient {
  private accessToken?: string;
  private expiresAt = 0;

  constructor(private readonly creds: GmailCredentials) {}

  private async token(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt - 60_000) return this.accessToken;
    const res = await request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.creds.clientId,
        client_secret: this.creds.clientSecret,
        refresh_token: this.creds.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.expiresAt = Date.now() + data.expires_in * 1000;
    return this.accessToken;
  }

  private async auth(): Promise<Record<string, string>> {
    return { authorization: `Bearer ${await this.token()}` };
  }

  /** Message ids matching a Gmail search query, newest first. */
  async listMessageIds(query: string, max = 100): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({ q: query, maxResults: String(Math.min(100, max - ids.length)) });
      if (pageToken) params.set('pageToken', pageToken);
      const data = await getJson<{ messages?: Array<{ id: string }>; nextPageToken?: string }>(
        `${API}/messages?${params}`,
        { headers: await this.auth() },
      );
      ids.push(...(data.messages ?? []).map((m) => m.id));
      pageToken = data.nextPageToken;
    } while (pageToken && ids.length < max);
    return ids;
  }

  async getMessage(id: string): Promise<GmailMessage> {
    return getJson<GmailMessage>(`${API}/messages/${id}?format=full`, { headers: await this.auth() });
  }

  /** Send a plain HTML email to yourself (used for the morning digest). Needs the gmail.send scope. */
  async sendHtml(to: string, subject: string, html: string): Promise<void> {
    // A line break in a header would let someone add their own headers (e.g. Bcc).
    if (/[\r\n]/.test(to) || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(to)) throw new Error('Invalid digest email address');
    const mime = [
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      '',
      html,
    ].join('\r\n');
    await request(`${API}/messages/send`, {
      method: 'POST',
      headers: { ...(await this.auth()), 'content-type': 'application/json' },
      body: JSON.stringify({ raw: Buffer.from(mime).toString('base64url') }),
    });
  }
}

export function header(msg: GmailMessage, name: string): string {
  const h = msg.payload?.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? '';
}

/** The HTML body of a message (falls back to the plain-text body). */
export function messageHtml(msg: GmailMessage): string {
  const html: string[] = [];
  const text: string[] = [];
  const walk = (p?: Part) => {
    if (!p) return;
    const data = p.body?.data ? Buffer.from(p.body.data, 'base64url').toString('utf8') : '';
    if (data && p.mimeType === 'text/html') html.push(data);
    else if (data && p.mimeType === 'text/plain') text.push(data);
    p.parts?.forEach(walk);
  };
  walk(msg.payload);
  if (html.length) return html.join('\n');
  return text.map((t) => `<pre>${t.replace(/</g, '&lt;')}</pre>`).join('\n');
}
