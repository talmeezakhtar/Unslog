import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { digestEmailHtml, digestTelegram } from '../src/stages/digest.js';
import { templateCoverNote, templateOutreach } from '../src/stages/draft.js';
import type { Profile } from '../src/types.js';

const content = {
  jobs: [{ id: 'j1', title: 'Dev <script>', company: 'A & B', city: 'Dubai', score: 88 }],
  followUps: [{ id: 'a1', title: 'QA', company: 'C', appliedAt: null }],
};

describe('digest formatting', () => {
  it('escapes HTML in Telegram messages and links to the dashboard', () => {
    const msg = digestTelegram(content, 'https://unslog.example');
    assert.match(msg, /Dev &lt;script&gt;/);
    assert.match(msg, /A &amp; B/);
    assert.match(msg, /href="https:\/\/unslog\.example\/jobs\/j1"/);
    assert.match(msg, /Follow-ups due \(1\)/);
  });

  it('says so when there are no jobs', () => {
    assert.match(digestTelegram({ jobs: [], followUps: [] }, 'x'), /No new strong matches/);
    assert.match(digestEmailHtml({ jobs: [], followUps: [] }, 'x'), /No new strong matches/);
  });
});

describe('template drafts (used when no AI is available)', () => {
  const p = { fullName: 'Usman Ali', skills: ['Node.js', 'Java'], yearsExperience: 1, highlightProject: 'a rug design configurator' } as Profile;
  const job = { id: 'j', title: 'Backend Developer', company: 'Acme', city: 'Dubai', description: null, experienceMin: null, visaFlags: [], skills: ['Node.js', 'Kafka'], postedAt: null, firstSeenAt: new Date() };

  it('fills in the job and the shared skills', () => {
    const note = templateCoverNote(p, job);
    assert.match(note, /Backend Developer role in Dubai/);
    assert.match(note, /Node\.js/);
    assert.doesNotMatch(note, /Kafka/);
    assert.match(note, /1 year of experience/);
    assert.match(note, /Usman Ali$/);
  });

  it('keeps the outreach note under 300 characters', () => {
    assert.ok(templateOutreach(p, job).length <= 300);
    assert.match(templateOutreach(p, job), /^Hi \[Name\],/);
  });
});
