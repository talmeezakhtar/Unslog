import { log } from '../../lib/log.js';
import type { Collector, CollectorResult, RawJob } from '../types.js';
import { GmailClient, header, messageHtml } from './client.js';
import { GMAIL_SOURCES, parseAlertEmail } from './parsers.js';

/** Gmail search used to find alert emails. Domains match any sender address at that site. */
export function alertQuery(days: number): string {
  return `from:(indeed.com OR linkedin.com OR bayt.com OR naukrigulf.com) newer_than:${days}d`;
}

/**
 * How many days back to search: just past the last successful run (plus a 1-day buffer for
 * clock skew and Gmail's day-granularity `newer_than`), falling back to the configured window
 * when there's no previous successful run yet. Concept: incremental collection via a watermark.
 */
export function windowDays(since: Date | null, fallbackDays: number): number {
  if (!since) return fallbackDays;
  const daysSince = Math.ceil((Date.now() - since.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(1, daysSince + 1);
}

export interface GmailCreds {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/**
 * Reads job-alert emails you already receive (Indeed, LinkedIn, Bayt, Naukrigulf) from Gmail.
 * The sites send these emails to you themselves, so nothing here scrapes their websites.
 *
 * One instance = one person's inbox: clientId/clientSecret are the app's own OAuth client
 * (shared across every user), refreshToken is that one user's own grant, captured at sign-in.
 */
export class GmailCollector implements Collector {
  readonly name = 'gmail';
  readonly sourceKeys = GMAIL_SOURCES.map((s) => s.key);
  constructor(private readonly creds: GmailCreds, private readonly queryDays: number, private readonly since: Date | null = null) {}

  isConfigured(): boolean {
    return Boolean(this.creds.clientId && this.creds.clientSecret && this.creds.refreshToken);
  }

  async collect(): Promise<CollectorResult> {
    const client = new GmailClient(this.creds);
    const days = windowDays(this.since, this.queryDays);
    const ids = await client.listMessageIds(alertQuery(days), 200);
    const jobs: RawJob[] = [];
    let parsedEmails = 0;
    for (const id of ids) {
      const msg = await client.getMessage(id);
      const from = header(msg, 'From');
      const date = msg.internalDate ? new Date(Number(msg.internalDate)) : null;
      const parsed = parseAlertEmail(from, messageHtml(msg), date, id);
      if (!parsed) continue;
      parsedEmails++;
      jobs.push(...parsed.jobs);
    }
    log.info('gmail alerts read', { emails: ids.length, alertEmails: parsedEmails, jobs: jobs.length });
    return { jobs, sources: GMAIL_SOURCES };
  }
}
