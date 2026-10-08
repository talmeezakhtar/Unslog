import { containsTerm } from '../lib/text.js';
import type { JobForMatching, Profile } from '../types.js';

export interface PrefilterResult {
  passed: boolean;
  /** Why it passed or failed, shown in the dashboard. */
  reason: string;
  /** 0-100 free heuristic score, used to choose which jobs are worth an AI call. */
  quickScore: number;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * The free filter: plain code, no AI. It runs on every new job, so it must be cheap.
 * Concept: funnel filtering. Cheap checks first, expensive AI only on what survives.
 */
export function prefilter(job: JobForMatching, profile: Profile, now = new Date()): PrefilterResult {
  const hay = `${job.title}\n${job.description ?? ''}`.toLowerCase();
  const titleLower = job.title.toLowerCase();
  const fail = (reason: string): PrefilterResult => ({ passed: false, reason, quickScore: 0 });

  const blocked = profile.blockedWords.find((w) => w.trim() && containsTerm(hay, w.toLowerCase().trim()));
  if (blocked) return fail(`Mentions blocked phrase "${blocked}"`);

  if (job.city && profile.cities.length > 0 && !profile.cities.some((c) => c.toLowerCase() === job.city!.toLowerCase())) {
    return fail(`In ${job.city}, not one of your cities`);
  }

  if (job.experienceMin !== null && job.experienceMin > profile.yearsExperience + 2) {
    return fail(`Asks for ${job.experienceMin}+ years (you have ${profile.yearsExperience})`);
  }

  if (profile.visaStatus === 'visit' && job.visaFlags.includes('residents_only')) {
    return fail('UAE residents only');
  }

  const mustHave = profile.mustHave.filter((w) => w.trim());
  if (mustHave.length > 0 && !mustHave.some((w) => containsTerm(hay, w.toLowerCase().trim()))) {
    return fail(`Mentions none of: ${mustHave.join(', ')}`);
  }

  // Quick score: skill overlap, title match and freshness.
  const mine = new Set(profile.skills.map((s) => s.toLowerCase()));
  const jobSkills = job.skills.map((s) => s.toLowerCase());
  const overlap = jobSkills.filter((s) => mine.has(s)).length;
  const skillScore = jobSkills.length === 0 ? (overlap > 0 ? 1 : 0.3) : overlap / Math.min(jobSkills.length, 6);
  const titleHit = profile.targetTitles.some((t) => {
    const words = t.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    return words.length > 0 && words.every((w) => titleLower.includes(w));
  });
  const ageDays = (now.getTime() - (job.postedAt ?? job.firstSeenAt).getTime()) / DAY;
  const freshness = ageDays <= 3 ? 1 : ageDays <= 7 ? 0.7 : ageDays <= 14 ? 0.4 : 0.2;
  const visaBonus = job.visaFlags.includes('visit_visa_ok') || job.visaFlags.includes('sponsorship') ? 5 : 0;

  const quickScore = Math.min(100, Math.round(55 * Math.min(skillScore, 1) + (titleHit ? 25 : 0) + 15 * freshness + visaBonus));
  const reason =
    overlap > 0 ? `Matches ${overlap} of your skills${titleHit ? ' and a target title' : ''}` : titleHit ? 'Matches a target title' : 'Passed your rules';
  return { passed: true, reason, quickScore };
}
