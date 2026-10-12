/**
 * The contract every collector follows (Strategy pattern): the rest of the pipeline never
 * knows whether a job came from an email, an API or a company careers page.
 */

/** A job exactly as one source described it, before normalization and deduplication. */
export interface RawJob {
  /** Which source it came from, e.g. 'gmail:indeed', 'jooble', 'ats:lever:acme'. */
  sourceKey: string;
  /** Stable id within that source (job id, or canonical URL when there is no id). */
  externalId: string;
  url: string;
  title: string;
  company?: string | null;
  location?: string | null;
  description?: string | null;
  /** True when description is the full posting rather than a snippet. */
  descriptionIsFull?: boolean;
  salaryText?: string | null;
  postedAt?: Date | null;
  /** The untouched source data, stored in raw_listings for replay. */
  raw: unknown;
}

/** Display info for a source, upserted into the sources table. */
export interface SourceInfo {
  key: string;
  name: string;
  kind: 'email' | 'api' | 'ats';
  config?: Record<string, unknown>;
}

export interface CollectorResult {
  jobs: RawJob[];
  /** Every source this collector produced jobs for (or might have). */
  sources: SourceInfo[];
}

export interface Collector {
  /** Name used in collector_runs, e.g. 'gmail', 'jooble', 'ats:greenhouse:acme'. */
  readonly name: string;
  /** Source keys this collector feeds, so a failure can be shown on those sources. */
  readonly sourceKeys: string[];
  /** False when required keys are missing; the run skips it with a log line instead of failing. */
  isConfigured(): boolean;
  collect(): Promise<CollectorResult>;
}

/** What the pipeline needs to know to collect from shared, public sources (ATS boards). Gmail
 *  and Jooble are personal now — see buildPersonalCollectors, built per-user in the main loop. */
export interface CollectContext {
  /** Distinct company boards across all users' target_companies. */
  companies: Array<{ ats: string; slug: string; name?: string }>;
}
