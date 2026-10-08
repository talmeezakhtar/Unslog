import type { Config } from '../../config.js';
import { log } from '../../lib/log.js';
import type { Collector, CollectorResult, RawJob } from '../types.js';
import { GmailClient, header, messageHtml } from './client.js';
import { GMAIL_SOURCES, parseAlertEmail } from './parsers.js';

/** Gmail search used to find alert emails. Domains match any sender address at that site. */
export function alertQuery(days: number): string {
  return `from:(indeed.com OR linkedin.com OR bayt.com OR naukrigulf.com) newer_than:${days}d`;
}

/**
 * Reads job-alert emails you already receive (Indeed, LinkedIn, Bayt, Naukrigulf) from Gmail.
 * The sites send these emails to you themselves, so nothing here scrapes their websites.
 */
export class GmailCollector implements Collector {
  readonly name = 'gmail';
  readonly sourceKeys = GMAIL_SOURCES.map((s) => s.key);
  constructor(private readonly config: Config) {}

  isConfigured(): boolean {
    return Boolean(this.config.GMAIL_CLIENT_ID && this.config.GMAIL_CLIENT_SECRET && this.config.GMAIL_REFRESH_TOKEN);
  }

  async collect(): Promise<CollectorResult> {
    const client = new GmailClient({
      clientId: this.config.GMAIL_CLIENT_ID!,
      clientSecret: this.config.GMAIL_CLIENT_SECRET!,
      refreshToken: this.config.GMAIL_REFRESH_TOKEN!,
    });
    const ids = await client.listMessageIds(alertQuery(this.config.GMAIL_QUERY_DAYS), 200);
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
