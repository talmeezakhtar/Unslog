import type { Element } from 'domhandler';
import { findAll, getAttributeValue } from 'domutils';
import { parseDocument } from 'htmlparser2';
import { clean, htmlToText, nodeText } from '../../lib/text.js';
import { detectCity, isUae } from '../../lib/uae.js';
import type { RawJob, SourceInfo } from '../types.js';

/**
 * Turns job-alert emails into RawJobs.
 *
 * Alert emails change their HTML often and differ by site, so instead of brittle per-site
 * CSS selectors we use one general strategy:
 *   1. find links that look like job links for that site (URL patterns below),
 *   2. canonicalize each link to a stable job id (so tracking parameters don't create duplicates),
 *   3. read the title from the link text and the company / location from the text block around it.
 *
 * This is best effort. If a site changes its emails, run `npm run gmail:sample` to save a few
 * real emails as private fixtures and adjust the rules here (docs/04-pipeline.md explains how).
 */

export type AlertSite = 'indeed' | 'linkedin' | 'bayt' | 'naukrigulf';

interface SiteRule {
  site: AlertSite;
  name: string;
  from: RegExp;
  /** Links are only accepted on these hosts (and over http/https), never e.g. javascript: URLs. */
  host: RegExp;
  jobLink: RegExp;
  canonical(url: URL): { url: string; id: string } | null;
}

const stripQuery = (u: URL) => `${u.origin}${u.pathname}`;

export const SITE_RULES: SiteRule[] = [
  {
    site: 'indeed',
    name: 'Indeed (email alerts)',
    from: /indeed\./i,
    host: /(^|\.)indeed\.[a-z.]+$/i,
    // Newer alerts wrap every link in an opaque cts.indeed.com tracking URL; those are kept as-is
    // (the fingerprint still dedupes them against other sites).
    jobLink: /indeed\.[a-z.]+\/.*(rc\/clk|pagead\/clk|viewjob|applystart)|[?&]jk=|cts\.indeed\.com\//i,
    canonical(u) {
      const jk = u.searchParams.get('jk') ?? u.searchParams.get('vjk');
      if (jk && /^[a-f0-9]{8,}$/i.test(jk)) return { id: jk, url: `https://ae.indeed.com/viewjob?jk=${jk}` };
      if (/^cts\.indeed\.com$/i.test(u.hostname)) return { id: stripQuery(u), url: u.toString() };
      return /viewjob|rc\/clk|pagead\/clk|applystart/i.test(u.pathname) ? { id: stripQuery(u), url: u.toString() } : null;
    },
  },
  {
    site: 'linkedin',
    name: 'LinkedIn (email alerts)',
    from: /linkedin\.com/i,
    host: /(^|\.)linkedin\.com$/i,
    jobLink: /linkedin\.com\/(comm\/)?jobs\/view\/\d+/i,
    canonical(u) {
      const m = u.pathname.match(/jobs\/view\/(\d+)/);
      return m ? { id: m[1]!, url: `https://www.linkedin.com/jobs/view/${m[1]}/` } : null;
    },
  },
  {
    site: 'bayt',
    name: 'Bayt (email alerts)',
    from: /bayt\.com/i,
    host: /(^|\.)bayt\.com$/i,
    jobLink: /bayt\.com\/[a-z]{2}\/.*jobs?\//i,
    canonical(u) {
      const m = u.pathname.match(/-(\d{5,})\/?$/);
      if (m) return { id: m[1]!, url: stripQuery(u) };
      return /\/jobs?\//.test(u.pathname) ? { id: stripQuery(u), url: stripQuery(u) } : null;
    },
  },
  {
    site: 'naukrigulf',
    name: 'Naukrigulf (email alerts)',
    from: /naukrigulf\.com/i,
    host: /(^|\.)naukrigulf\.com$/i,
    jobLink: /naukrigulf\.com\/.*-\d{6,}/i,
    canonical(u) {
      const m = u.pathname.match(/-(\d{6,})\/?$/) ?? u.pathname.match(/-(\d{6,})/);
      return m ? { id: m[1]!, url: stripQuery(u) } : null;
    },
  },
];

export const GMAIL_SOURCES: SourceInfo[] = SITE_RULES.map((r) => ({
  key: `gmail:${r.site}`,
  name: r.name,
  kind: 'email' as const,
}));

/** Link texts that are buttons, not job titles. */
const CTA = /^(view( (job|all|more|details|similar))?|apply( now)?|easy apply|see (all|more|jobs)|more jobs|search|save|unsubscribe|manage|settings|job alert|jobs? for you|click here|learn more|show|open|download|get the app|help|privacy|home)\b/i;

const NOISE_LINE = /(\bago\b|posted|actively recruiting|easy apply|promoted|applicants?|be an early applicant|new\b$|aed\s?[\d,]|salary|^\d+ (new )?jobs?)/i;

export function siteForSender(from: string): SiteRule | undefined {
  return SITE_RULES.find((r) => r.from.test(from));
}

function looksLikeTitle(text: string): boolean {
  return text.length >= 3 && text.length <= 120 && /[a-z]/i.test(text) && !CTA.test(text) && !/^https?:/i.test(text);
}

/** Split "Acme LLC · Dubai, UAE" or "Acme LLC - Dubai" into company and location. */
export function splitCompanyLocation(line: string): { company: string | null; location: string | null } {
  const parts = line.split(/\s+[·•|–-]\s+/).map(clean).filter(Boolean);
  if (parts.length >= 2) {
    const locIdx = parts.findIndex((p) => isUae(p));
    if (locIdx > 0) return { company: parts.slice(0, locIdx).join(' - '), location: parts.slice(locIdx).join(', ') };
  }
  return isUae(line) && !/\b(llc|ltd|fz|group|company|technologies)\b/i.test(line)
    ? { company: null, location: line }
    : { company: line, location: null };
}

/** Reads company + location from the lines of text that follow the title in its block. */
export function contextFromLines(lines: string[], title: string): { company: string | null; location: string | null } {
  const idx = lines.findIndex((l) => l.toLowerCase().includes(title.toLowerCase()));
  const after = (idx >= 0 ? lines.slice(idx + 1) : lines)
    .map(clean)
    .filter((l) => l && l !== title && !CTA.test(l) && !/^https?:\/\//i.test(l));
  let company: string | null = null;
  let location: string | null = null;
  for (const line of after.slice(0, 5)) {
    if (NOISE_LINE.test(line)) continue;
    const split = splitCompanyLocation(line);
    if (!company && split.company) company = split.company;
    if (!location && split.location) location = split.location;
    if (company && location) break;
  }
  return { company, location };
}

/**
 * The text of the smallest container around a link that still looks like "one job":
 * we climb up from the link while the text stays short (a job card, not the whole email).
 */
function blockAround(el: Element): string {
  let best = nodeText(el);
  let node: Element = el;
  for (let i = 0; i < 6; i++) {
    const parent = node.parent;
    if (!parent || parent.type !== 'tag') break;
    const text = clean(nodeText(parent as Element));
    if (text.length > 450) break;
    best = nodeText(parent as Element);
    node = parent as Element;
  }
  return best;
}

export interface ParsedAlert {
  site: AlertSite;
  jobs: RawJob[];
}

/**
 * Parse one alert email. `from` is the From header, `html` the body, `receivedAt` the email date.
 * Returns null when the sender is not a known job site.
 */
export function parseAlertEmail(from: string, html: string, receivedAt: Date | null, messageId = ''): ParsedAlert | null {
  const rule = siteForSender(from);
  if (!rule) return null;
  const doc = parseDocument(html);
  const byId = new Map<string, RawJob>();

  const consider = (href: string, text: string, block: string) => {
    if (!rule.jobLink.test(href)) return;
    let u: URL;
    try {
      u = new URL(href);
    } catch {
      return;
    }
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || !rule.host.test(u.hostname)) return;
    const canon = rule.canonical(u);
    if (!canon) return;
    const existing = byId.get(canon.id);
    const title = looksLikeTitle(text) ? text : '';
    if (existing && existing.title) return; // first good title wins
    if (!title && existing) return;
    const ctx = title ? contextFromLines(block.split('\n'), title) : { company: null, location: null };
    byId.set(canon.id, {
      sourceKey: `gmail:${rule.site}`,
      externalId: canon.id,
      url: canon.url,
      title,
      company: ctx.company,
      location: ctx.location ?? (detectCity(block) ? detectCity(block) : null),
      description: block.slice(0, 1500) || null,
      descriptionIsFull: false,
      postedAt: receivedAt,
      raw: { messageId, href, text, block: block.slice(0, 2000) },
    });
  };

  const links = findAll((el) => el.name.toLowerCase() === 'a' && Boolean(getAttributeValue(el, 'href')), doc.children);
  for (const a of links) {
    const href = (getAttributeValue(a, 'href') ?? '').trim();
    consider(href, clean(nodeText(a)), blockAround(a));
  }

  // Plain-text emails: a URL on its own line, with the title on the line above it.
  if (byId.size === 0) {
    const lines = htmlToText(html).split('\n').map(clean).filter(Boolean);
    lines.forEach((line, i) => {
      const m = line.match(/https?:\/\/\S+/);
      if (!m) return;
      const titleLine = lines[i - 1] ?? '';
      consider(m[0], looksLikeTitle(titleLine) ? titleLine : '', lines.slice(Math.max(0, i - 1), i + 4).join('\n'));
    });
  }

  const jobs = [...byId.values()].filter((j) => j.title);
  return { site: rule.site, jobs };
}
