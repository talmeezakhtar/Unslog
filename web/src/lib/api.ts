import { supabase } from './supabase';
import type {
  Application,
  ApplicationStatus,
  CollectorRun,
  Contact,
  Draft,
  DraftType,
  Interview,
  Match,
  Outreach,
  OutreachChannel,
  Profile,
  SavedSearch,
  TodaySummary,
} from './types';

/**
 * Every query the dashboard makes, in one file. Row Level Security on the database decides
 * what each user can see, so these queries never need a "where user_id = me" for reads.
 */

type Result<T> = { data: T | null; error: { message: string } | null };
function unwrap<T>({ data, error }: Result<T>): T {
  if (error) throw new Error(error.message);
  return data as T;
}

const JOB_FIELDS = `id, title, city, description, description_is_full, salary_text, experience_min, visa_flags,
  posted_at, first_seen_at, company:companies(id, name), sightings:job_sightings(url, source:sources(name, key))`;
const MATCH_FIELDS = `id, job_id, prefilter_passed, prefilter_reason, score, reasons, missing_skills, visa_note, model,
  dismissed_at, created_at`;

export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not signed in');
  return data.user.id;
}

// ---------------------------------------------------------------- Today

export async function todaySummary(): Promise<TodaySummary> {
  return unwrap(await supabase.rpc('today_summary')) as TodaySummary;
}

export async function aiUsageToday(): Promise<number> {
  const rows = (unwrap(await supabase.rpc('ai_usage_today')) ?? []) as Array<{ requests: number }>;
  return rows.reduce((n, r) => n + r.requests, 0);
}

/** Best scored matches from the last day that you haven't acted on yet. */
export async function topMatches(limit = 10): Promise<Match[]> {
  const since = new Date(Date.now() - 36 * 3600_000).toISOString();
  const [matches, apps] = await Promise.all([
    supabase
      .from('job_matches')
      .select(`${MATCH_FIELDS}, job:jobs!inner(${JOB_FIELDS})`)
      .eq('prefilter_passed', true)
      .is('dismissed_at', null)
      .not('score', 'is', null)
      .gte('created_at', since)
      .order('score', { ascending: false })
      .limit(limit * 3),
    supabase.from('applications').select('job_id'),
  ]);
  const acted = new Set((unwrap(apps) as Array<{ job_id: string }>).map((a) => a.job_id));
  return (unwrap(matches) as unknown as Match[]).filter((m) => !acted.has(m.job_id)).slice(0, limit);
}

export async function followUpsDue(): Promise<Application[]> {
  const now = new Date().toISOString();
  return unwrap(
    await supabase
      .from('applications')
      .select('id, job_id, status, channel, applied_at, next_follow_up_at, notes, updated_at, job:jobs(id, title, city, company:companies(id, name))')
      .or(`status.eq.follow_up_due,and(status.eq.applied,next_follow_up_at.lte.${now})`)
      .order('applied_at', { ascending: true }),
  ) as unknown as Application[];
}

/** Latest run of each collector, for the health card. */
export async function collectorHealth(): Promise<CollectorRun[]> {
  const rows = unwrap(
    await supabase.from('collector_runs').select('collector, status, found, new_count, started_at, finished_at, error').order('started_at', { ascending: false }).limit(60),
  ) as CollectorRun[];
  const latest = new Map<string, CollectorRun>();
  for (const r of rows) if (!latest.has(r.collector)) latest.set(r.collector, r);
  return [...latest.values()];
}

// ---------------------------------------------------------------- Jobs

export interface JobFilters {
  search?: string;
  view: 'new' | 'dismissed' | 'all';
  city?: string;
  minScore?: number;
  hideResidentsOnly?: boolean;
  passedOnly?: boolean;
  sort: 'score' | 'newest';
  page: number;
  pageSize: number;
}

export async function jobFeed(f: JobFilters): Promise<{ rows: Match[]; total: number }> {
  let q = supabase.from('job_matches').select(`${MATCH_FIELDS}, job:jobs!inner(${JOB_FIELDS})`, { count: 'exact' });
  if (f.view === 'new') q = q.is('dismissed_at', null);
  if (f.view === 'dismissed') q = q.not('dismissed_at', 'is', null);
  if (f.passedOnly) q = q.eq('prefilter_passed', true);
  if (f.minScore) q = q.gte('score', f.minScore);
  if (f.city) q = q.eq('job.city', f.city);
  if (f.search?.trim()) q = q.ilike('job.title', `%${f.search.trim().replace(/[%_,()]/g, ' ')}%`);
  if (f.hideResidentsOnly) q = q.not('job.visa_flags', 'cs', '{residents_only}');
  q =
    f.sort === 'score'
      ? q.order('score', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
      : q.order('created_at', { ascending: false });
  const from = f.page * f.pageSize;
  const { data, error, count } = await q.range(from, from + f.pageSize - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as Match[], total: count ?? 0 };
}

export async function setDismissed(matchId: string, dismissed: boolean): Promise<void> {
  unwrap(await supabase.from('job_matches').update({ dismissed_at: dismissed ? new Date().toISOString() : null }).eq('id', matchId));
}

// ---------------------------------------------------------------- Job detail

export interface JobDetail {
  match: Match | null;
  job: Match['job'];
  skills: string[];
  drafts: Draft[];
  application: Application | null;
  events: Array<{ from_status: string | null; to_status: string; at: string }>;
  interviews: Interview[];
  contacts: Contact[];
}

export async function jobDetail(jobId: string): Promise<JobDetail> {
  const [job, match, skills, drafts, application] = await Promise.all([
    supabase.from('jobs').select(JOB_FIELDS).eq('id', jobId).single(),
    supabase.from('job_matches').select(MATCH_FIELDS).eq('job_id', jobId).maybeSingle(),
    supabase.from('job_skills').select('skill:skills(name)').eq('job_id', jobId),
    supabase.from('drafts').select('id, job_id, type, content, model, edited_by_user, updated_at').eq('job_id', jobId),
    supabase.from('applications').select('id, job_id, status, channel, applied_at, next_follow_up_at, notes, updated_at').eq('job_id', jobId).maybeSingle(),
  ]);
  const jobRow = unwrap(job) as unknown as Match['job'];
  const app = unwrap(application) as Application | null;
  const companyId = jobRow.company?.id;
  const [events, interviews, contacts] = await Promise.all([
    app ? supabase.from('application_events').select('from_status, to_status, at').eq('application_id', app.id).order('at') : Promise.resolve({ data: [], error: null }),
    app ? supabase.from('interviews').select('*').eq('application_id', app.id).order('round') : Promise.resolve({ data: [], error: null }),
    companyId ? supabase.from('contacts').select('*').eq('company_id', companyId).order('created_at') : Promise.resolve({ data: [], error: null }),
  ]);
  const m = unwrap(match) as Match | null;
  return {
    job: jobRow,
    match: m ? { ...m, job: jobRow } : null,
    skills: (unwrap(skills) as unknown as Array<{ skill: { name: string } | null }>).map((s) => s.skill?.name ?? '').filter(Boolean).sort(),
    drafts: unwrap(drafts) as Draft[],
    application: app,
    events: unwrap(events as Result<JobDetail['events']>) ?? [],
    interviews: (unwrap(interviews as Result<Interview[]>) ?? []) as Interview[],
    contacts: (unwrap(contacts as Result<Contact[]>) ?? []) as Contact[],
  };
}

export async function setApplicationStatus(jobId: string, status: ApplicationStatus, channel?: string): Promise<void> {
  const user_id = await currentUserId();
  const { data: existing } = await supabase.from('applications').select('id').eq('job_id', jobId).maybeSingle();
  if (existing) {
    unwrap(await supabase.from('applications').update({ status, ...(channel ? { channel } : {}) }).eq('id', (existing as { id: string }).id));
  } else {
    unwrap(await supabase.from('applications').insert({ user_id, job_id: jobId, status, channel: channel ?? null }));
  }
}

export async function updateApplicationNotes(applicationId: string, notes: string): Promise<void> {
  unwrap(await supabase.from('applications').update({ notes }).eq('id', applicationId));
}

export async function saveDraft(jobId: string, type: DraftType, content: string): Promise<void> {
  const user_id = await currentUserId();
  unwrap(
    await supabase
      .from('drafts')
      .upsert({ user_id, job_id: jobId, type, content, edited_by_user: true }, { onConflict: 'user_id,job_id,type' }),
  );
}

export async function addInterview(applicationId: string, i: Pick<Interview, 'round' | 'type' | 'scheduled_at' | 'notes'>): Promise<void> {
  const user_id = await currentUserId();
  unwrap(await supabase.from('interviews').insert({ user_id, application_id: applicationId, ...i }));
}

export async function setInterviewOutcome(id: string, outcome: Interview['outcome']): Promise<void> {
  unwrap(await supabase.from('interviews').update({ outcome }).eq('id', id));
}

// ---------------------------------------------------------------- Pipeline

export async function applications(): Promise<Application[]> {
  return unwrap(
    await supabase
      .from('applications')
      .select('id, job_id, status, channel, applied_at, next_follow_up_at, notes, updated_at, job:jobs(id, title, city, company:companies(id, name))')
      .order('updated_at', { ascending: false }),
  ) as unknown as Application[];
}

// ---------------------------------------------------------------- Contacts and outreach

export async function contacts(): Promise<Contact[]> {
  return unwrap(await supabase.from('contacts').select('*, company:companies(name)').order('created_at', { ascending: false })) as unknown as Contact[];
}

export async function addContact(c: Pick<Contact, 'name' | 'role' | 'linkedin_url' | 'email' | 'company_id' | 'how_found'>): Promise<Contact> {
  const user_id = await currentUserId();
  return unwrap(await supabase.from('contacts').insert({ user_id, ...c }).select('*').single()) as Contact;
}

export async function outreachLog(): Promise<Outreach[]> {
  return unwrap(
    await supabase
      .from('outreach')
      .select('*, contact:contacts(id, name, role, company:companies(name)), job:jobs(id, title)')
      .order('sent_at', { ascending: false }),
  ) as unknown as Outreach[];
}

export async function logOutreach(o: { contact_id: string; job_id: string | null; channel: OutreachChannel; message: string }): Promise<void> {
  const user_id = await currentUserId();
  unwrap(await supabase.from('outreach').insert({ user_id, ...o, status: 'sent' }));
}

export async function setOutreachStatus(id: string, status: Outreach['status']): Promise<void> {
  unwrap(await supabase.from('outreach').update({ status, replied_at: status === 'replied' ? new Date().toISOString() : null }).eq('id', id));
}

/** Jobs you've saved or applied to, for linking outreach to a job. */
export async function jobsForOutreach(): Promise<Array<{ id: string; title: string; company: string | null; companyId: string | null }>> {
  const apps = await applications();
  return apps.filter((a) => a.job).map((a) => ({ id: a.job!.id, title: a.job!.title, company: a.job!.company?.name ?? null, companyId: a.job!.company?.id ?? null }));
}

export async function outreachDraft(jobId: string): Promise<string | null> {
  const { data } = await supabase.from('drafts').select('content').eq('job_id', jobId).eq('type', 'outreach').maybeSingle();
  return (data as { content: string } | null)?.content ?? null;
}

// ---------------------------------------------------------------- Insights

export const insights = {
  topSkills: async (days: number) => unwrap(await supabase.rpc('insights_top_skills', { days, lim: 15 })) as Array<{ skill: string; jobs: number; share: number }>,
  topCompanies: async (days: number) => unwrap(await supabase.rpc('insights_top_companies', { days, lim: 10 })) as Array<{ company: string; jobs: number }>,
  jobsPerWeek: async (weeks: number) => unwrap(await supabase.rpc('insights_jobs_per_week', { weeks })) as Array<{ week: string; jobs: number }>,
  salaries: async (days: number) => unwrap(await supabase.rpc('insights_salary_by_title', { days, lim: 8 })) as Array<{ title: string; jobs: number; low: number; high: number }>,
  funnel: async () => unwrap(await supabase.rpc('insights_funnel')) as Array<{ stage: string; n: number }>,
  replies: async () => unwrap(await supabase.rpc('insights_reply_by_channel')) as Array<{ channel: string; sent: number; replied: number }>,
};

// ---------------------------------------------------------------- Settings

export async function profile(): Promise<Profile | null> {
  return unwrap(await supabase.from('profiles').select('*').maybeSingle()) as Profile | null;
}

export async function saveProfile(p: Omit<Profile, 'user_id'>): Promise<void> {
  const user_id = await currentUserId();
  unwrap(await supabase.from('profiles').upsert({ ...p, user_id }));
}

export async function savedSearches(): Promise<SavedSearch[]> {
  return unwrap(await supabase.from('saved_searches').select('id, keywords, location, site, enabled').order('created_at')) as SavedSearch[];
}

export async function addSavedSearch(keywords: string, location: string): Promise<void> {
  const user_id = await currentUserId();
  unwrap(await supabase.from('saved_searches').insert({ user_id, keywords, location, site: 'jooble' }));
}

export async function removeSavedSearch(id: string): Promise<void> {
  unwrap(await supabase.from('saved_searches').delete().eq('id', id));
}

export async function sources(): Promise<Array<{ key: string; name: string; kind: string; enabled: boolean; last_success_at: string | null; last_error: string | null }>> {
  return unwrap(await supabase.from('sources').select('key, name, kind, enabled, last_success_at, last_error').order('kind')) as never;
}
