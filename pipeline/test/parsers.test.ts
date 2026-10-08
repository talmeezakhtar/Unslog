import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { contextFromLines, parseAlertEmail, splitCompanyLocation } from '../src/collectors/gmail/parsers.js';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const date = new Date('2026-10-08T03:00:00Z');

describe('Indeed alert emails', () => {
  const parsed = parseAlertEmail('Indeed <alert@indeed.com>', fixture('indeed-alert.html'), date)!;

  it('finds every job once, ignoring "View job" and footer links', () => {
    assert.equal(parsed.site, 'indeed');
    assert.deepEqual(
      parsed.jobs.map((j) => j.title),
      ['Backend Developer (Node.js)', 'Junior Java Developer', 'Full Stack Developer'],
    );
  });

  it('canonicalizes tracking links to a stable job id', () => {
    const first = parsed.jobs[0]!;
    assert.equal(first.externalId, 'a1b2c3d4e5f60718');
    assert.equal(first.url, 'https://ae.indeed.com/viewjob?jk=a1b2c3d4e5f60718');
    assert.equal(first.sourceKey, 'gmail:indeed');
  });

  it('reads company and location from the job block', () => {
    assert.equal(parsed.jobs[0]!.company, 'Acme Technologies LLC');
    assert.equal(parsed.jobs[0]!.location, 'Dubai');
    assert.equal(parsed.jobs[1]!.company, 'Gulf Systems FZ-LLC');
    assert.equal(parsed.jobs[1]!.location, 'Abu Dhabi');
    assert.equal(parsed.jobs[2]!.company, 'Nimbus Labs');
    assert.equal(parsed.jobs[2]!.location, 'Sharjah');
  });

  it('keeps the block text as a snippet and the email date as posted date', () => {
    assert.match(parsed.jobs[0]!.description ?? '', /REST APIs/);
    assert.equal(parsed.jobs[0]!.postedAt?.toISOString(), date.toISOString());
  });
});

describe('LinkedIn alert emails', () => {
  const parsed = parseAlertEmail('LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>', fixture('linkedin-alert.html'), date)!;

  it('merges the logo link and the title link into one job', () => {
    assert.equal(parsed.jobs.length, 2);
    assert.equal(parsed.jobs[0]!.title, 'Software Engineer, Backend');
    assert.equal(parsed.jobs[0]!.url, 'https://www.linkedin.com/jobs/view/3912345678/');
  });

  it('splits "Company · City, Country"', () => {
    assert.equal(parsed.jobs[0]!.company, 'Careem');
    assert.equal(parsed.jobs[0]!.location, 'Dubai, United Arab Emirates');
    assert.equal(parsed.jobs[1]!.company, 'Talabat');
  });
});

describe('Bayt alert emails', () => {
  const parsed = parseAlertEmail('Bayt.com <jobs@bayt.com>', fixture('bayt-alert.html'), date)!;

  it('reads lines separated by <br>', () => {
    assert.deepEqual(parsed.jobs.map((j) => j.title), ['Full Stack Developer', '.NET Developer']);
    assert.equal(parsed.jobs[0]!.company, 'Bright Minds Group');
    assert.equal(parsed.jobs[0]!.location, 'Sharjah, United Arab Emirates');
    assert.equal(parsed.jobs[0]!.externalId, '5123456');
    assert.equal(parsed.jobs[0]!.url, 'https://www.bayt.com/en/uae/jobs/full-stack-developer-5123456/');
  });
});

describe('Naukrigulf plain-text emails', () => {
  const html = `<pre>${fixture('naukrigulf-alert.txt')}</pre>`;
  const parsed = parseAlertEmail('Naukrigulf <jobalerts@naukrigulf.com>', html, date)!;

  it('uses the line above a bare URL as the title', () => {
    assert.deepEqual(parsed.jobs.map((j) => j.title), ['Python Developer', 'Data Engineer']);
    assert.equal(parsed.jobs[0]!.externalId, '211024500123');
    assert.equal(parsed.jobs[0]!.company, 'Tech Corp');
    assert.equal(parsed.jobs[0]!.location, 'Dubai');
  });
});

describe('link safety and newer link formats', () => {
  it('ignores javascript: links and links to other hosts', () => {
    const html = `<a href="javascript:alert(1)//viewjob?jk=abcdef0123">Evil</a><a href="https://evil.example/viewjob?jk=abcdef0123">Also evil</a>`;
    assert.equal(parseAlertEmail('Indeed <alert@indeed.com>', html, date)!.jobs.length, 0);
  });

  it('accepts opaque cts.indeed.com tracking links', () => {
    const html = `<table><tr><td><a href="https://cts.indeed.com/v3/H4sIAAAAAAAA_abc123">Backend Developer</a><div>Acme LLC - Dubai</div></td></tr></table>`;
    const parsed = parseAlertEmail('Indeed <alert@indeed.com>', html, date)!;
    assert.equal(parsed.jobs.length, 1);
    assert.equal(parsed.jobs[0]!.company, 'Acme LLC');
  });
});

describe('other emails', () => {
  it('returns null for senders that are not job sites', () => {
    assert.equal(parseAlertEmail('Friend <me@example.com>', '<a href="https://x.com">hi</a>', date), null);
  });

  it('returns no jobs for a job-site email without job links', () => {
    const parsed = parseAlertEmail('Indeed <alert@indeed.com>', '<p>Your password was changed</p><a href="https://ae.indeed.com/account">Account</a>', date)!;
    assert.equal(parsed.jobs.length, 0);
  });
});

describe('splitCompanyLocation / contextFromLines', () => {
  it('handles the common separators', () => {
    assert.deepEqual(splitCompanyLocation('Acme LLC - Dubai'), { company: 'Acme LLC', location: 'Dubai' });
    assert.deepEqual(splitCompanyLocation('Acme · Abu Dhabi, UAE'), { company: 'Acme', location: 'Abu Dhabi, UAE' });
    assert.deepEqual(splitCompanyLocation('Dubai, United Arab Emirates'), { company: null, location: 'Dubai, United Arab Emirates' });
    assert.deepEqual(splitCompanyLocation('Emirates Technologies LLC'), { company: 'Emirates Technologies LLC', location: null });
  });

  it('skips noise lines like "2 days ago" and salaries', () => {
    const ctx = contextFromLines(['Developer', 'Posted 2 days ago', 'AED 10,000', 'Acme', 'Dubai'], 'Developer');
    assert.deepEqual(ctx, { company: 'Acme', location: 'Dubai' });
  });
});
