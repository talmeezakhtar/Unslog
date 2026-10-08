/** Row shapes the dashboard reads. They mirror supabase/migrations/20261008000000_init.sql. */

export type ApplicationStatus = 'saved' | 'applied' | 'follow_up_due' | 'interview' | 'offer' | 'rejected' | 'withdrawn';
export type DraftType = 'cover_note' | 'outreach' | 'follow_up';
export type OutreachChannel = 'linkedin' | 'email' | 'whatsapp' | 'other';

export interface Sighting {
  url: string;
  source: { name: string; key: string } | null;
}

export interface Job {
  id: string;
  title: string;
  city: string | null;
  description: string | null;
  description_is_full: boolean;
  salary_text: string | null;
  experience_min: number | null;
  visa_flags: string[];
  posted_at: string | null;
  first_seen_at: string;
  company: { id: string; name: string } | null;
  sightings: Sighting[];
}

export interface Match {
  id: string;
  job_id: string;
  prefilter_passed: boolean;
  prefilter_reason: string | null;
  score: number | null;
  reasons: string[];
  missing_skills: string[];
  visa_note: string | null;
  model: string | null;
  dismissed_at: string | null;
  created_at: string;
  job: Job;
}

export interface Application {
  id: string;
  job_id: string;
  status: ApplicationStatus;
  channel: string | null;
  applied_at: string | null;
  next_follow_up_at: string | null;
  notes: string | null;
  updated_at: string;
  job?: Pick<Job, 'id' | 'title' | 'city' | 'company'> | null;
}

export interface Draft {
  id: string;
  job_id: string;
  type: DraftType;
  content: string;
  model: string | null;
  edited_by_user: boolean;
  updated_at: string;
}

export interface Contact {
  id: string;
  company_id: string | null;
  name: string;
  role: string | null;
  linkedin_url: string | null;
  email: string | null;
  how_found: string | null;
  notes: string | null;
  company?: { name: string } | null;
}

export interface Outreach {
  id: string;
  contact_id: string;
  job_id: string | null;
  channel: OutreachChannel;
  message: string | null;
  status: 'sent' | 'replied' | 'no_reply';
  sent_at: string;
  replied_at: string | null;
  contact?: Pick<Contact, 'id' | 'name' | 'role'> & { company?: { name: string } | null };
  job?: { id: string; title: string } | null;
}

export interface Interview {
  id: string;
  application_id: string;
  round: number;
  type: 'hr' | 'technical' | 'final' | 'other';
  scheduled_at: string | null;
  outcome: 'pending' | 'passed' | 'failed';
  notes: string | null;
}

export interface TargetCompany {
  ats: 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'smartrecruiters';
  slug: string;
  name?: string;
}

export interface Profile {
  user_id: string;
  full_name: string | null;
  headline: string | null;
  skills: string[];
  years_experience: number;
  target_titles: string[];
  cities: string[];
  visa_status: 'visit' | 'resident' | 'needs_sponsorship';
  cv_text: string | null;
  highlight_project: string | null;
  must_have: string[];
  blocked_words: string[];
  min_score: number;
  max_ai_jobs_per_day: number;
  follow_up_days: number;
  target_companies: TargetCompany[];
  digest_channel: 'none' | 'telegram' | 'email';
  digest_email: string | null;
  telegram_chat_id: string | null;
}

export interface SavedSearch {
  id: string;
  keywords: string;
  location: string;
  site: string;
  enabled: boolean;
}

export interface TodaySummary {
  new_jobs_today: number;
  matches_today: number;
  passed_today: number;
  ai_scored_today: number;
  followups_due: number;
  interviews_week: number;
  last_run_at: string | null;
}

export interface CollectorRun {
  collector: string;
  status: 'running' | 'success' | 'failed';
  found: number;
  new_count: number;
  started_at: string;
  finished_at: string | null;
  error: string | null;
}

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  follow_up_due: 'Follow-up due',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};
