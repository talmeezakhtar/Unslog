import { createHash } from 'node:crypto';
import { clean } from '../lib/text.js';
import { isUae } from '../lib/uae.js';

/**
 * Deduplication: the same opening shows up on Indeed, LinkedIn and Jooble with different URLs.
 * We give each opening a fingerprint built from what stays the same across sites:
 * company + title + city, normalized. Same fingerprint = same job.
 */

const LEGAL_SUFFIXES =
  /\b(l\.?l\.?c\.?|fz[- ]?llc|fze|fzco|fz|dmcc|ltd\.?|limited|inc\.?|incorporated|plc|pvt\.?|private|co\.?|company|corp\.?|corporation|gmbh|s\.?a\.?|llp|group|holding|holdings|uae|middle east|me)\b\.?/gi;

export function normalizeCompany(name: string | null | undefined): string {
  if (!name) return '';
  return clean(
    name
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/\(.*?\)/g, ' ')
      .replace(LEGAL_SUFFIXES, ' ')
      .replace(/[^a-z0-9 ]+/g, ' '),
  );
}

const TITLE_NOISE = /\b(urgent(ly)?|hiring|immediate joiner|immediate|walk[- ]?in|required|needed|wanted|vacancy|job|position|opening|for)\b/gi;

/** Suffixes like "- Dubai" or "| Urgent" are noise; "- Payments" names a different role and stays. */
const NOISE_SUFFIX = /^(urgent(ly)?( hiring)?|hiring( now)?|immediate( joiner)?|remote|hybrid|on-?site|full[- ]time|part[- ]time|contract|new)$/i;

function stripNoiseSuffix(title: string): string {
  const m = title.match(/\s[-–|:]\s(.*)$/);
  if (!m) return title;
  const suffix = clean(m[1]);
  return isUae(suffix) || NOISE_SUFFIX.test(suffix) ? title.slice(0, m.index) : title;
}

export function normalizeTitle(title: string): string {
  return clean(
    stripNoiseSuffix(title)
      .toLowerCase()
      .replace(/\(.*?\)|\[.*?\]/g, ' ')
      .replace(/\b(sr\.?)(?=\s)/g, 'senior')
      .replace(/\b(jr\.?)(?=\s)/g, 'junior')
      .replace(/\b(dev)\b/g, 'developer')
      .replace(/\b(engr)\b/g, 'engineer')
      .replace(TITLE_NOISE, ' ')
      .replace(/[^a-z0-9+#. ]+/g, ' '),
  );
}

/**
 * When the company is unknown (some alert emails omit it), fall back to the source's own id
 * so two different unknown-company jobs never collapse into one.
 */
export function fingerprint(input: { company: string | null | undefined; title: string; city: string | null; fallbackId: string }): string {
  const company = normalizeCompany(input.company);
  const key = company
    ? `${company}|${normalizeTitle(input.title)}|${(input.city ?? 'uae').toLowerCase()}`
    : `unknown|${input.fallbackId}`;
  return createHash('sha1').update(key).digest('hex');
}
