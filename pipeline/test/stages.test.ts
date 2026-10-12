import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { containsTerm, htmlToText, decodeEntities } from '../src/lib/text.js';
import { detectCity, isUae } from '../src/lib/uae.js';
import { fingerprint, normalizeCompany, normalizeTitle } from '../src/stages/dedupe.js';
import { experienceMin, extractSkills, parseSalary, visaFlags, type Skill } from '../src/stages/enrich.js';
import { normalize } from '../src/stages/normalize.js';
import { prefilter } from '../src/stages/prefilter.js';
import type { JobForMatching, Profile } from '../src/types.js';

const SKILLS: Skill[] = [
  { id: 1, name: 'Java', aliases: ['java', 'j2ee'] },
  { id: 2, name: 'JavaScript', aliases: ['javascript', 'es6'] },
  { id: 3, name: 'Node.js', aliases: ['node.js', 'nodejs', 'node js'] },
  { id: 4, name: 'C#', aliases: ['c#', 'csharp'] },
  { id: 5, name: '.NET', aliases: ['.net', 'dotnet', 'asp.net'] },
  { id: 6, name: 'Spring Boot', aliases: ['spring boot', 'springboot'] },
  { id: 7, name: 'Go', aliases: ['golang'] },
  { id: 8, name: 'SQL', aliases: ['sql'] },
];

describe('text helpers', () => {
  it('turns HTML into readable lines', () => {
    assert.equal(htmlToText('<p>Hello <b>there</b></p><ul><li>One</li><li>Two</li></ul><script>x()</script>'), 'Hello there\nOne\nTwo');
    assert.equal(htmlToText('a<br>b'), 'a\nb');
    assert.equal(htmlToText(null), '');
  });

  it('decodes escaped HTML', () => {
    assert.equal(decodeEntities('&lt;p&gt;Hi &amp; bye&lt;/p&gt;'), '<p>Hi & bye</p>');
  });

  it('matches whole terms, including ones with symbols', () => {
    assert.equal(containsTerm('we use java and spring', 'java'), true);
    assert.equal(containsTerm('we use javascript', 'java'), false);
    assert.equal(containsTerm('c# and .net core', 'c#'), true);
    assert.equal(containsTerm('c# and .net core', '.net'), true);
    assert.equal(containsTerm('mysql only', 'sql'), false);
  });
});

describe('UAE locations', () => {
  it('maps messy strings to a city', () => {
    assert.equal(detectCity('Dubai Internet City, Dubai'), 'Dubai');
    assert.equal(detectCity('Abudhabi'), 'Abu Dhabi');
    assert.equal(detectCity('Musaffah'), 'Abu Dhabi');
    assert.equal(detectCity('Riyadh, Saudi Arabia'), null);
    assert.equal(isUae('United Arab Emirates'), true);
    assert.equal(isUae('London, UK'), false);
  });

  it('maps Arabic-script city and country names', () => {
    assert.equal(detectCity('دبي'), 'Dubai');
    assert.equal(detectCity('أبوظبي'), 'Abu Dhabi');
    assert.equal(detectCity('ابو ظبي'), 'Abu Dhabi');
    assert.equal(detectCity('الشارقة'), 'Sharjah');
    assert.equal(detectCity('الرياض، السعودية'), null);
    assert.equal(isUae('الإمارات العربية المتحدة'), true);
  });
});

describe('deduplication fingerprint', () => {
  it('normalizes company legal suffixes', () => {
    assert.equal(normalizeCompany('Acme Technologies L.L.C.'), 'acme technologies');
    assert.equal(normalizeCompany('ACME Technologies FZ-LLC'), 'acme technologies');
    assert.equal(normalizeCompany('Acme Technologies (Dubai Branch)'), 'acme technologies');
  });

  it('keeps role suffixes but drops location and noise suffixes', () => {
    assert.notEqual(normalizeTitle('Software Engineer - Payments'), normalizeTitle('Software Engineer - Platform'));
    assert.equal(normalizeTitle('Software Engineer - Abu Dhabi'), 'software engineer');
    assert.equal(normalizeTitle('Software Engineer | Remote'), 'software engineer');
  });

  it('normalizes titles', () => {
    assert.equal(normalizeTitle('Sr. Backend Dev - Dubai'), 'senior backend developer');
    assert.equal(normalizeTitle('URGENT HIRING: Java Developer'), normalizeTitle('Java Developer'));
  });

  it('gives the same opening on different sites the same fingerprint', () => {
    const a = fingerprint({ company: 'Acme Technologies LLC', title: 'Backend Developer', city: 'Dubai', fallbackId: 'x' });
    const b = fingerprint({ company: 'ACME TECHNOLOGIES L.L.C', title: 'Backend Developer (Urgent)', city: 'Dubai', fallbackId: 'y' });
    const c = fingerprint({ company: 'Acme Technologies LLC', title: 'Backend Developer', city: 'Abu Dhabi', fallbackId: 'z' });
    assert.equal(a, b);
    assert.notEqual(a, c);
  });

  it('never merges two unknown-company jobs', () => {
    const a = fingerprint({ company: null, title: 'Developer', city: 'Dubai', fallbackId: 'gmail:indeed:1' });
    const b = fingerprint({ company: null, title: 'Developer', city: 'Dubai', fallbackId: 'gmail:indeed:2' });
    assert.notEqual(a, b);
  });
});

describe('enrichment', () => {
  it('extracts skills as whole words', () => {
    const names = (t: string) => extractSkills(t, SKILLS).map((s) => s.name).sort();
    assert.deepEqual(names('Strong JavaScript and NodeJS, some SQL'), ['JavaScript', 'Node.js', 'SQL']);
    assert.deepEqual(names('Java 17, Spring Boot, MySQL'), ['Java', 'Spring Boot']);
    assert.deepEqual(names('C# / ASP.NET developer'), ['.NET', 'C#']);
    assert.deepEqual(names('Let us go to the gym'), []);
  });

  it('detects visa phrases', () => {
    assert.deepEqual(visaFlags('UAE residents only. Visa will be provided? no.'), ['residents_only', 'sponsorship']);
    assert.deepEqual(visaFlags('Visit visa holders can apply'), ['visit_visa_ok']);
    assert.deepEqual(visaFlags('Candidates must have own residence visa required'), ['residents_only']);
    assert.deepEqual(visaFlags('Great team, good salary'), []);
  });

  it('reads minimum experience', () => {
    assert.equal(experienceMin('3+ years of experience in Java'), 3);
    assert.equal(experienceMin('2-4 years experience'), 2);
    assert.equal(experienceMin('Minimum 5 years in backend'), 5);
    assert.equal(experienceMin('5 years of relevant experience'), 5);
    assert.equal(experienceMin('Fresh graduates welcome'), null);
  });

  it('parses monthly AED salaries and converts yearly ones', () => {
    assert.deepEqual(parseSalary('AED 9,000 - 12,000 a month'), { min: 9000, max: 12000 });
    assert.deepEqual(parseSalary('8000-10000 AED per month'), { min: 8000, max: 10000 });
    assert.deepEqual(parseSalary('AED 180k per year'), { min: 15000, max: null });
    assert.deepEqual(parseSalary('Competitive salary'), { min: null, max: null });
    assert.deepEqual(parseSalary('Founded in 2012, 300 staff. Salary AED 7,500.'), { min: 7500, max: null });
  });
});

describe('normalize', () => {
  it('builds the database shape from a raw job', () => {
    const job = normalize({
      sourceKey: 'gmail:indeed',
      externalId: 'abc',
      url: 'https://ae.indeed.com/viewjob?jk=abc',
      title: ' Backend  Developer ',
      company: 'Acme LLC',
      location: 'Dubai',
      description: 'Node.js, 3+ years. UAE residents only. AED 10,000 - 14,000 per month',
      raw: {},
    })!;
    assert.equal(job.title, 'Backend Developer');
    assert.equal(job.city, 'Dubai');
    assert.equal(job.companyNormalized, 'acme');
    assert.equal(job.experienceMin, 3);
    assert.deepEqual(job.visaFlags, ['residents_only']);
    assert.deepEqual([job.salaryMinAed, job.salaryMaxAed], [10000, 14000]);
    assert.equal(job.descriptionIsFull, false);
  });

  it('drops ATS jobs outside the UAE and jobs without a title', () => {
    assert.equal(normalize({ sourceKey: 'ats:lever:x', externalId: '1', url: 'u', title: 'Dev', location: 'Berlin, Germany', raw: {} }), null);
    assert.equal(normalize({ sourceKey: 'jooble', externalId: '1', url: 'u', title: '  ', raw: {} }), null);
  });
});

const profile: Profile = {
  userId: 'u1',
  fullName: 'Usman Ali',
  headline: null,
  skills: ['Node.js', 'Java', 'SQL'],
  yearsExperience: 1,
  targetTitles: ['backend developer'],
  cities: ['Dubai', 'Sharjah'],
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

const job = (over: Partial<JobForMatching> = {}): JobForMatching => ({
  id: 'j1',
  title: 'Backend Developer',
  company: 'Acme',
  city: 'Dubai',
  description: 'Node.js and SQL',
  experienceMin: null,
  visaFlags: [],
  skills: ['Node.js', 'SQL'],
  postedAt: new Date('2026-10-07'),
  firstSeenAt: new Date('2026-10-07'),
  ...over,
});

describe('prefilter', () => {
  const now = new Date('2026-10-08');

  it('passes a good match with a high quick score', () => {
    const r = prefilter(job(), profile, now);
    assert.equal(r.passed, true);
    assert.ok(r.quickScore >= 80, `quick score ${r.quickScore}`);
    assert.match(r.reason, /2 of your skills/);
  });

  it('fails each rule with a readable reason', () => {
    assert.match(prefilter(job({ city: 'Abu Dhabi' }), profile, now).reason, /not one of your cities/);
    assert.match(prefilter(job({ experienceMin: 5 }), profile, now).reason, /5\+ years/);
    assert.match(prefilter(job({ visaFlags: ['residents_only'] }), profile, now).reason, /residents only/);
    assert.match(prefilter(job({ description: 'Arabic speaker required' }), profile, now).reason, /blocked phrase/);
    assert.match(prefilter(job(), { ...profile, mustHave: ['react'] }, now).reason, /none of: react/);
  });

  it('lets residents through residents-only jobs and unknown cities through', () => {
    assert.equal(prefilter(job({ visaFlags: ['residents_only'] }), { ...profile, visaStatus: 'resident' }, now).passed, true);
    assert.equal(prefilter(job({ city: null }), profile, now).passed, true);
  });

  it('scores fresh, on-target jobs above old, off-target ones', () => {
    const fresh = prefilter(job(), profile, now).quickScore;
    const old = prefilter(job({ title: 'Software Engineer', skills: ['Java'], postedAt: new Date('2026-09-01') }), profile, now).quickScore;
    assert.ok(fresh > old);
  });
});
