import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { prefilter } from '../src/stages/prefilter.js';
import type { JobForMatching, Profile } from '../src/types.js';

/**
 * Evaluation set: fixed jobs with expected score bands. Guards against silent regressions in
 * `prefilter()` — the free heuristic that both ranks candidates for AI scoring and is saved
 * directly as the score when no AI provider is available. Concept: AI/scoring regression test.
 */

const profile: Profile = {
  userId: 'eval-user',
  fullName: 'Eval Candidate',
  headline: null,
  skills: ['Node.js', 'TypeScript', 'SQL', 'React'],
  yearsExperience: 3,
  targetTitles: ['backend developer', 'full stack developer'],
  cities: ['Dubai', 'Abu Dhabi'],
  visaStatus: 'visit',
  cvText: null,
  highlightProject: null,
  mustHave: [],
  blockedWords: ['arabic speaker'],
  minScore: 60,
  maxAiJobsPerDay: 30,
  followUpDays: 6,
  targetCompanies: [],
  digestChannel: 'none',
  digestEmail: null,
  telegramChatId: null,
};

const now = new Date('2026-10-08');
const job = (over: Partial<JobForMatching> = {}): JobForMatching => ({
  id: 'j',
  title: 'Backend Developer',
  company: 'Acme',
  city: 'Dubai',
  description: '',
  experienceMin: null,
  visaFlags: [],
  skills: [],
  postedAt: now,
  firstSeenAt: now,
  ...over,
});

interface Case {
  name: string;
  job: JobForMatching;
  passed: boolean;
  /** [min, max] inclusive band for quickScore when passed is true. */
  band?: [number, number];
}

const cases: Case[] = [
  {
    name: 'full skill overlap, target title, fresh, visa sponsored',
    job: job({ title: 'Backend Developer', skills: ['Node.js', 'TypeScript', 'SQL', 'React'], visaFlags: ['sponsorship'] }),
    passed: true,
    band: [95, 100],
  },
  {
    name: 'full skill overlap, target title, fresh, no visa bonus',
    job: job({ title: 'Backend Developer', skills: ['Node.js', 'TypeScript', 'SQL', 'React'] }),
    passed: true,
    band: [90, 99],
  },
  {
    name: 'partial skill overlap, no title hit, fresh',
    job: job({ title: 'Platform Engineer', skills: ['Node.js', 'Go', 'Kubernetes'] }),
    passed: true,
    band: [25, 45],
  },
  {
    name: 'no skills listed but title hits',
    job: job({ title: 'Full Stack Developer', skills: [] }),
    passed: true,
    band: [40, 60],
  },
  {
    name: 'good skills, title hit, stale (20 days)',
    job: job({ skills: ['Node.js', 'TypeScript'], postedAt: new Date('2026-09-18'), firstSeenAt: new Date('2026-09-18') }),
    passed: true,
    band: [75, 90],
  },
  {
    name: 'same skills as above but fresh scores higher than the stale one',
    job: job({ skills: ['Node.js', 'TypeScript'] }),
    passed: true,
    band: [75, 95],
  },
  {
    name: 'no matching skills, no title hit, fresh',
    job: job({ title: 'Warehouse Supervisor', skills: ['Forklift'] }),
    passed: true,
    band: [10, 30],
  },
  {
    name: 'city outside the profile fails',
    job: job({ city: 'Riyadh' }),
    passed: false,
  },
  {
    name: 'experience bar too high fails',
    job: job({ experienceMin: 8 }),
    passed: false,
  },
  {
    name: 'residents-only fails for a visit-visa profile',
    job: job({ visaFlags: ['residents_only'] }),
    passed: false,
  },
  {
    name: 'blocked phrase fails',
    job: job({ description: 'Must be a native Arabic speaker' }),
    passed: false,
  },
  {
    name: 'unknown city still passes',
    job: job({ city: null, skills: ['Node.js', 'TypeScript'] }),
    passed: true,
  },
];

describe('scoring eval set', () => {
  for (const c of cases) {
    it(c.name, () => {
      const r = prefilter(c.job, profile, now);
      assert.equal(r.passed, c.passed, `expected passed=${c.passed}, reason: ${r.reason}`);
      if (c.passed && c.band) {
        const [min, max] = c.band;
        assert.ok(r.quickScore >= min && r.quickScore <= max, `quickScore ${r.quickScore} outside [${min}, ${max}] for "${c.name}"`);
      }
    });
  }
});
