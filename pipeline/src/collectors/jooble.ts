import type { Config } from '../config.js';
import { Throttle, request } from '../lib/http.js';
import { log } from '../lib/log.js';
import { clean, htmlToText } from '../lib/text.js';
import type { Collector, CollectorResult, RawJob } from './types.js';

/** Shape of one job in Jooble's API response. All fields can be missing or empty. */
export interface JoobleJob {
  id?: string | number;
  title?: string;
  location?: string;
  snippet?: string;
  salary?: string;
  source?: string;
  type?: string;
  link?: string;
  company?: string;
  updated?: string;
}

interface JoobleResponse {
  totalCount?: number;
  jobs?: JoobleJob[];
}

export const JOOBLE_SOURCE = { key: 'jooble', name: 'Jooble', kind: 'api' as const };

export function mapJoobleJob(j: JoobleJob): RawJob | null {
  const title = clean(j.title ? htmlToText(j.title) : '');
  const url = clean(j.link);
  if (!title || !url) return null;
  const updated = j.updated ? new Date(j.updated) : null;
  return {
    sourceKey: JOOBLE_SOURCE.key,
    externalId: j.id !== undefined && j.id !== null ? String(j.id) : url,
    url,
    title,
    company: clean(j.company) || null,
    location: clean(j.location) || null,
    description: j.snippet ? htmlToText(j.snippet) : null,
    descriptionIsFull: false,
    salaryText: clean(j.salary) || null,
    postedAt: updated && !Number.isNaN(updated.getTime()) ? updated : null,
    raw: j,
  };
}

/**
 * Jooble aggregates many job boards and offers a free API key (https://jooble.org/api/about).
 * POST https://jooble.org/api/<key> with { keywords, location, page }.
 */
export class JoobleCollector implements Collector {
  readonly name = 'jooble';
  readonly sourceKeys = [JOOBLE_SOURCE.key];
  private readonly throttle: Throttle;

  constructor(
    private readonly config: Config,
    private readonly searches: Array<{ keywords: string; location: string }>,
  ) {
    this.throttle = new Throttle(config.HTTP_DELAY_MS);
  }

  isConfigured(): boolean {
    return Boolean(this.config.JOOBLE_API_KEY) && this.searches.length > 0;
  }

  async collect(): Promise<CollectorResult> {
    const url = `https://${this.config.JOOBLE_HOST}/api/${this.config.JOOBLE_API_KEY}`;
    const jobs: RawJob[] = [];
    for (const search of this.searches) {
      for (let page = 1; page <= this.config.JOOBLE_PAGES; page++) {
        await this.throttle.wait();
        const res = await request(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'user-agent': this.config.HTTP_USER_AGENT },
          body: JSON.stringify({ keywords: search.keywords, location: search.location, page: String(page) }),
        });
        const data = (await res.json()) as JoobleResponse;
        const batch = (data.jobs ?? []).map(mapJoobleJob).filter((j): j is RawJob => j !== null);
        log.debug('jooble page', { keywords: search.keywords, page, count: batch.length });
        jobs.push(...batch);
        if (batch.length === 0) break;
      }
    }
    return { jobs, sources: [JOOBLE_SOURCE] };
  }
}
