import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { boardUrl, mapAshby, mapGreenhouse, mapLever, mapSmartRecruiters, mapWorkable, sourceKey } from '../src/collectors/ats.js';
import { alertQuery } from '../src/collectors/gmail/index.js';
import { mapJoobleJob } from '../src/collectors/jooble.js';
import { redact } from '../src/lib/http.js';

describe('Jooble', () => {
  it('maps a job and strips HTML from the snippet', () => {
    const j = mapJoobleJob({
      id: 123,
      title: 'Java <b>Developer</b>',
      company: 'Acme',
      location: 'Dubai',
      snippet: '&nbsp;...Spring Boot and <b>microservices</b>...',
      salary: 'AED 12000',
      link: 'https://jooble.org/desc/123',
      updated: '2026-10-07T10:00:00.000',
    })!;
    assert.equal(j.title, 'Java Developer');
    assert.equal(j.externalId, '123');
    assert.match(j.description!, /Spring Boot and microservices/);
    assert.equal(j.descriptionIsFull, false);
    assert.equal(j.sourceKey, 'jooble');
  });

  it('skips jobs without a title or link', () => {
    assert.equal(mapJoobleJob({ title: 'Dev' }), null);
    assert.equal(mapJoobleJob({ link: 'https://x' }), null);
  });
});

describe('company ATS boards', () => {
  const t = (ats: 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'smartrecruiters') => ({ ats, slug: 'acme', name: 'Acme' });

  it('Greenhouse: decodes the escaped HTML description', () => {
    const [job] = mapGreenhouse(t('greenhouse'), {
      jobs: [{ id: 7, title: 'Backend Engineer', absolute_url: 'https://boards.greenhouse.io/acme/jobs/7', location: { name: 'Dubai, UAE' }, content: '&lt;p&gt;Node.js &amp;amp; Postgres&lt;/p&gt;', updated_at: '2026-10-01T00:00:00Z' }],
    });
    assert.equal(job!.description, 'Node.js & Postgres');
    assert.equal(job!.descriptionIsFull, true);
    assert.equal(job!.sourceKey, 'ats:greenhouse:acme');
  });

  it('Lever: prefers the UAE location among several', () => {
    const [job] = mapLever(t('lever'), [
      { id: 'abc', text: 'Engineer', hostedUrl: 'https://jobs.lever.co/acme/abc', categories: { location: 'London', allLocations: ['London', 'Dubai'] }, descriptionPlain: 'Build things', lists: [{ text: 'Requirements', content: '<li>Java</li>' }], createdAt: 1_760_000_000_000 },
    ]);
    assert.equal(job!.location, 'Dubai');
    assert.match(job!.description!, /Requirements\nJava/);
  });

  it('Ashby, Workable and SmartRecruiters map their own shapes', () => {
    const [a] = mapAshby(t('ashby'), { jobs: [{ title: 'Dev', jobUrl: 'https://jobs.ashbyhq.com/acme/1', location: 'Remote', secondaryLocations: [{ location: 'Abu Dhabi' }], compensation: { compensationTierSummary: 'AED 20K – 25K' } }] });
    assert.equal(a!.location, 'Abu Dhabi');
    assert.equal(a!.salaryText, 'AED 20K – 25K');

    const [w] = mapWorkable(t('workable'), { name: 'Acme Inc', jobs: [{ title: 'QA', shortcode: 'XY12', url: 'https://apply.workable.com/acme/j/XY12/', city: 'Dubai', country: 'United Arab Emirates', description: '<p>Testing</p>' }] });
    assert.equal(w!.company, 'Acme Inc');
    assert.equal(w!.location, 'Dubai, United Arab Emirates');
    assert.equal(w!.description, 'Testing');

    const [s] = mapSmartRecruiters(t('smartrecruiters'), { content: [{ id: '744', name: 'Data Analyst', location: { city: 'Dubai', country: 'ae' } }] });
    assert.equal(s!.url, 'https://jobs.smartrecruiters.com/acme/744');
    assert.equal(s!.location, 'Dubai, United Arab Emirates');
  });

  it('builds the public board URLs and stable source keys', () => {
    assert.equal(boardUrl(t('greenhouse')), 'https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true');
    assert.equal(boardUrl(t('lever')), 'https://api.lever.co/v0/postings/acme?mode=json');
    assert.equal(sourceKey({ ats: 'lever', slug: 'ACME' }), 'ats:lever:acme');
  });
});

describe('helpers', () => {
  it('Gmail query covers the four alert senders', () => {
    assert.equal(alertQuery(3), 'from:(indeed.com OR linkedin.com OR bayt.com OR naukrigulf.com) newer_than:3d');
  });

  it('redacts keys from URLs before logging', () => {
    assert.equal(redact('https://jooble.org/api/0123456789abcdef-xyz'), 'https://jooble.org/api/***');
    assert.equal(redact('https://x.com/a?key=SECRET&b=1'), 'https://x.com/a?key=***&b=1');
    assert.equal(redact('https://api.telegram.org/bot123:ABC/sendMessage'), 'https://api.telegram.org/bot***/sendMessage');
  });
});
