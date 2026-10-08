import type { Config } from '../config.js';
import { Throttle, getJson } from '../lib/http.js';
import { clean, decodeEntities, htmlToText } from '../lib/text.js';
import { isUae } from '../lib/uae.js';
import type { Collector, CollectorResult, RawJob, SourceInfo } from './types.js';

/**
 * Company career pages. Many companies host their careers page on an applicant tracking
 * system (ATS) that publishes a public JSON list of open jobs, meant to be read by anyone.
 * Each mapper turns one ATS's shape into our RawJob. Only UAE-located jobs are kept.
 */

export type AtsName = 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'smartrecruiters';
export const ATS_NAMES: AtsName[] = ['greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters'];

export interface AtsTarget {
  ats: AtsName;
  slug: string;
  name?: string;
}

const toDate = (v: unknown): Date | null => {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(v as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
};

// ---- Greenhouse: https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
export interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  updated_at?: string;
  first_published?: string;
  content?: string;
  company_name?: string;
}
export function mapGreenhouse(target: AtsTarget, data: { jobs?: GreenhouseJob[] }): RawJob[] {
  return (data.jobs ?? []).map((j) => ({
    sourceKey: sourceKey(target),
    externalId: String(j.id),
    url: j.absolute_url,
    title: clean(j.title),
    company: j.company_name ?? target.name ?? target.slug,
    location: j.location?.name ?? null,
    description: j.content ? htmlToText(decodeEntities(j.content)) : null,
    descriptionIsFull: Boolean(j.content),
    postedAt: toDate(j.first_published ?? j.updated_at),
    raw: j,
  }));
}

// ---- Lever: https://api.lever.co/v0/postings/{slug}?mode=json
export interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  categories?: { location?: string; allLocations?: string[]; team?: string; commitment?: string };
  descriptionPlain?: string;
  additionalPlain?: string;
  lists?: Array<{ text?: string; content?: string }>;
  createdAt?: number;
}
export function mapLever(target: AtsTarget, data: LeverJob[]): RawJob[] {
  return (Array.isArray(data) ? data : []).map((j) => {
    const lists = (j.lists ?? []).map((l) => `${l.text ?? ''}\n${htmlToText(l.content)}`).join('\n\n');
    const description = [j.descriptionPlain, lists, j.additionalPlain].filter(Boolean).join('\n\n');
    const locations = [j.categories?.location, ...(j.categories?.allLocations ?? [])].filter(Boolean);
    return {
      sourceKey: sourceKey(target),
      externalId: j.id,
      url: j.hostedUrl,
      title: clean(j.text),
      company: target.name ?? target.slug,
      location: locations.find((l) => isUae(l)) ?? locations[0] ?? null,
      description: description || null,
      descriptionIsFull: Boolean(description),
      postedAt: toDate(j.createdAt),
      raw: j,
    };
  });
}

// ---- Ashby: https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true
export interface AshbyJob {
  id?: string;
  title: string;
  location?: string;
  secondaryLocations?: Array<{ location?: string }>;
  jobUrl: string;
  descriptionPlain?: string;
  publishedAt?: string;
  compensation?: { compensationTierSummary?: string };
}
export function mapAshby(target: AtsTarget, data: { jobs?: AshbyJob[] }): RawJob[] {
  return (data.jobs ?? []).map((j) => {
    const locations = [j.location, ...(j.secondaryLocations ?? []).map((l) => l.location)].filter(Boolean) as string[];
    return {
      sourceKey: sourceKey(target),
      externalId: j.id ?? j.jobUrl,
      url: j.jobUrl,
      title: clean(j.title),
      company: target.name ?? target.slug,
      location: locations.find((l) => isUae(l)) ?? locations[0] ?? null,
      description: j.descriptionPlain ?? null,
      descriptionIsFull: Boolean(j.descriptionPlain),
      salaryText: j.compensation?.compensationTierSummary ?? null,
      postedAt: toDate(j.publishedAt),
      raw: j,
    };
  });
}

// ---- Workable: https://apply.workable.com/api/v1/widget/accounts/{slug}?details=true
export interface WorkableJob {
  title: string;
  shortcode?: string;
  url?: string;
  shortlink?: string;
  city?: string;
  state?: string;
  country?: string;
  location?: { location_str?: string; city?: string; country?: string };
  locations?: Array<{ city?: string; country?: string; region?: string }>;
  published_on?: string;
  created_at?: string;
  description?: string;
}
export function mapWorkable(target: AtsTarget, data: { name?: string; jobs?: WorkableJob[] }): RawJob[] {
  return (data.jobs ?? []).map((j) => {
    const locations = [
      j.location?.location_str,
      [j.city, j.country].filter(Boolean).join(', '),
      ...(j.locations ?? []).map((l) => [l.city, l.region, l.country].filter(Boolean).join(', ')),
    ].filter((l): l is string => Boolean(l));
    const url = j.url ?? j.shortlink ?? `https://apply.workable.com/${target.slug}/j/${j.shortcode}/`;
    return {
      sourceKey: sourceKey(target),
      externalId: j.shortcode ?? url,
      url,
      title: clean(j.title),
      company: data.name ?? target.name ?? target.slug,
      location: locations.find((l) => isUae(l)) ?? locations[0] ?? null,
      description: j.description ? htmlToText(j.description) : null,
      descriptionIsFull: Boolean(j.description),
      postedAt: toDate(j.published_on ?? j.created_at),
      raw: j,
    };
  });
}

// ---- SmartRecruiters: https://api.smartrecruiters.com/v1/companies/{slug}/postings?country=ae
export interface SmartRecruitersJob {
  id: string;
  name: string;
  releasedDate?: string;
  location?: { city?: string; region?: string; country?: string; fullLocation?: string };
  company?: { name?: string };
}
export function mapSmartRecruiters(target: AtsTarget, data: { content?: SmartRecruitersJob[] }): RawJob[] {
  return (data.content ?? []).map((j) => {
    const loc = j.location;
    const location = loc?.fullLocation ?? [loc?.city, loc?.region, loc?.country === 'ae' ? 'United Arab Emirates' : loc?.country].filter(Boolean).join(', ');
    return {
      sourceKey: sourceKey(target),
      externalId: j.id,
      url: `https://jobs.smartrecruiters.com/${target.slug}/${j.id}`,
      title: clean(j.name),
      company: j.company?.name ?? target.name ?? target.slug,
      location: location || null,
      description: null,
      descriptionIsFull: false,
      postedAt: toDate(j.releasedDate),
      raw: j,
    };
  });
}

export function sourceKey(t: AtsTarget): string {
  return `ats:${t.ats}:${t.slug.toLowerCase()}`;
}

export function sourceInfo(t: AtsTarget): SourceInfo {
  return { key: sourceKey(t), name: `${t.name ?? t.slug} careers (${t.ats})`, kind: 'ats', config: { ...t } };
}

export function boardUrl(t: AtsTarget): string {
  const slug = encodeURIComponent(t.slug);
  switch (t.ats) {
    case 'greenhouse':
      return `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
    case 'lever':
      return `https://api.lever.co/v0/postings/${slug}?mode=json`;
    case 'ashby':
      return `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`;
    case 'workable':
      return `https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`;
    case 'smartrecruiters':
      return `https://api.smartrecruiters.com/v1/companies/${slug}/postings?country=ae&limit=100`;
  }
}

export function mapBoard(t: AtsTarget, data: unknown): RawJob[] {
  switch (t.ats) {
    case 'greenhouse':
      return mapGreenhouse(t, data as { jobs?: GreenhouseJob[] });
    case 'lever':
      return mapLever(t, data as LeverJob[]);
    case 'ashby':
      return mapAshby(t, data as { jobs?: AshbyJob[] });
    case 'workable':
      return mapWorkable(t, data as { jobs?: WorkableJob[] });
    case 'smartrecruiters':
      return mapSmartRecruiters(t, data as { content?: SmartRecruitersJob[] });
  }
}

/** One collector per company board, so one broken board never hides the others. */
export class AtsCollector implements Collector {
  readonly name: string;
  readonly sourceKeys: string[];
  constructor(
    private readonly config: Config,
    private readonly target: AtsTarget,
    private readonly throttle: Throttle,
  ) {
    this.name = sourceKey(target);
    this.sourceKeys = [this.name];
  }

  isConfigured(): boolean {
    return ATS_NAMES.includes(this.target.ats) && this.target.slug.trim() !== '';
  }

  async collect(): Promise<CollectorResult> {
    await this.throttle.wait();
    const data = await getJson<unknown>(boardUrl(this.target), {
      headers: { 'user-agent': this.config.HTTP_USER_AGENT },
    });
    const jobs = mapBoard(this.target, data).filter((j) => j.title && j.url && isUae(j.location));
    return { jobs, sources: [sourceInfo(this.target)] };
  }
}
