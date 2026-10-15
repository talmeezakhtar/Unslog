import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scoringProfile } from '../src/run.js';
import type { Profile } from '../src/types.js';

const profile: Profile = {
  userId: 'u1',
  fullName: 'Usman Ali',
  headline: null,
  skills: [],
  yearsExperience: 1,
  targetTitles: [],
  cities: [],
  visaStatus: 'visit',
  cvText: null,
  highlightProject: null,
  mustHave: [],
  blockedWords: [],
  minScore: 60,
  maxAiJobsPerDay: 500,
  followUpDays: 6,
  targetCompanies: [],
  digestChannel: 'none',
  digestEmail: null,
  telegramChatId: null,
};

describe('scoringProfile: fair use of the shared AI key', () => {
  it('clamps a shared-key profile to the per-user slice, however high its own setting is', () => {
    const p = scoringProfile(profile, false, { SHARED_AI_MAX_JOBS_PER_USER_PER_DAY: 20 });
    assert.equal(p.maxAiJobsPerDay, 20);
  });

  it('never raises a lower setting up to the shared cap', () => {
    const p = scoringProfile({ ...profile, maxAiJobsPerDay: 5 }, false, { SHARED_AI_MAX_JOBS_PER_USER_PER_DAY: 20 });
    assert.equal(p.maxAiJobsPerDay, 5);
  });

  it('leaves a BYOK profile alone — it spends its own key, not the shared one', () => {
    const p = scoringProfile(profile, true, { SHARED_AI_MAX_JOBS_PER_USER_PER_DAY: 20 });
    assert.equal(p.maxAiJobsPerDay, 500);
  });
});
