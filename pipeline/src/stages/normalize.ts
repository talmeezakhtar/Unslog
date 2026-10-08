import type { RawJob } from '../collectors/types.js';
import { clean, truncate } from '../lib/text.js';
import { detectCity, isUae } from '../lib/uae.js';
import { fingerprint, normalizeCompany } from './dedupe.js';
import { experienceMin, parseSalary, visaFlags } from './enrich.js';

/** One job in the shape our database wants, still without ids. */
export interface NormalizedJob {
  fingerprint: string;
  title: string;
  companyName: string | null;
  companyNormalized: string | null;
  city: string | null;
  description: string | null;
  descriptionIsFull: boolean;
  salaryText: string | null;
  salaryMinAed: number | null;
  salaryMaxAed: number | null;
  experienceMin: number | null;
  visaFlags: string[];
  postedAt: Date | null;
  sighting: { sourceKey: string; externalId: string; url: string };
}

const MAX_DESCRIPTION = 20_000;

/**
 * Turns one source's raw job into our common shape (the "T" in ETL).
 * Returns null for jobs we should drop (no title, or clearly outside the UAE).
 */
export function normalize(raw: RawJob): NormalizedJob | null {
  const title = clean(raw.title);
  if (!title || !/^https?:\/\//i.test(raw.url)) return null;
  const location = clean(raw.location);
  // Email alerts and Jooble are already UAE-filtered by the search; drop only explicit non-UAE locations.
  if (location && !isUae(location) && !/remote/i.test(location) && raw.sourceKey.startsWith('ats:')) return null;

  const company = clean(raw.company) || null;
  const city = detectCity(location) ?? detectCity(title);
  const description = raw.description ? truncate(raw.description.trim(), MAX_DESCRIPTION) : null;
  const text = `${title}\n${description ?? ''}`;
  const salaryText = clean(raw.salaryText) || null;
  const salary = parseSalary(salaryText ?? description);

  return {
    fingerprint: fingerprint({ company, title, city, fallbackId: `${raw.sourceKey}:${raw.externalId}` }),
    title,
    companyName: company,
    companyNormalized: company ? normalizeCompany(company) || null : null,
    city,
    description,
    descriptionIsFull: Boolean(raw.descriptionIsFull && description),
    salaryText,
    salaryMinAed: salary.min,
    salaryMaxAed: salary.max,
    experienceMin: experienceMin(text),
    visaFlags: visaFlags(text),
    postedAt: raw.postedAt ?? null,
    sighting: { sourceKey: raw.sourceKey, externalId: raw.externalId, url: raw.url },
  };
}
