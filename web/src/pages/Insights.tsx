import { useState } from 'react';
import { insights, profile } from '../lib/api';
import { shortDate } from '../lib/format';
import { useAsync } from '../lib/hooks';
import { ColumnChart, DataTable, HBarChart, RangeChart } from '../components/charts';
import { Empty, ErrorBox, Loading } from '../components/ui';

const aed = (n: number) => `AED ${Math.round(n / 100) / 10}k`;

export function Insights() {
  const [days, setDays] = useState(30);
  const me = useAsync(profile);
  const skills = useAsync(() => insights.topSkills(days), [days]);
  const companies = useAsync(() => insights.topCompanies(days), [days]);
  const weekly = useAsync(() => insights.jobsPerWeek(12));
  const salaries = useAsync(() => insights.salaries(Math.max(days, 90)), [days]);
  const funnel = useAsync(insights.funnel);
  const replies = useAsync(insights.replies);
  const mine = new Set((me.data?.skills ?? []).map((s) => s.toLowerCase()));

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Insights</h1>
          <p className="muted">What the UAE market is asking for, and what's working for you.</p>
        </div>
        <div className="field">
          <label htmlFor="period">Period</label>
          <select id="period" className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </header>

      <div className="cols">
        <section className="panel wide" aria-labelledby="skills-h">
          <h2 id="skills-h">Skills most asked for</h2>
          <p className="small muted">Share of new jobs that mention each skill. Your skills are in amber.</p>
          <ErrorBox error={skills.error} />
          {skills.loading ? (
            <Loading rows={4} />
          ) : !skills.data?.length ? (
            <Empty title="Not enough jobs yet" />
          ) : (
            <>
              <div className="legend" aria-hidden="true">
                <span>Other skills</span>
                <span className="mine">Your skills</span>
              </div>
              <HBarChart
                label="Share of jobs mentioning each skill"
                rows={skills.data.map((s) => ({ label: s.skill, value: Number(s.share), tip: `${s.skill}: ${s.jobs} jobs (${s.share}%)` }))}
                format={(n) => `${n}%`}
                highlight={(l) => mine.has(l.toLowerCase())}
              />
              <DataTable caption="Skills most asked for" head={['Skill', 'Jobs', 'Share']} rows={skills.data.map((s) => [s.skill, s.jobs, `${s.share}%`])} />
            </>
          )}
        </section>

        <section className="panel narrow" aria-labelledby="co-h" style={{ display: 'grid' }}>
          <h2 id="co-h">Most active companies</h2>
          {companies.loading ? (
            <Loading rows={3} />
          ) : !companies.data?.length ? (
            <p className="small muted">No companies yet.</p>
          ) : (
            <ol className="list">
              {companies.data.map((c) => (
                <li key={c.company} className="health">
                  <span>{c.company}</span>
                  <span className="muted">{c.jobs} jobs</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="cols">
        <section className="panel" style={{ flex: '1 1 380px' }} aria-labelledby="weekly-h">
          <h2 id="weekly-h">New jobs per week</h2>
          {weekly.loading ? <Loading rows={2} /> : !weekly.data?.length ? <Empty title="No weeks yet" /> : <ColumnChart width={440} label="New unique jobs per week" rows={weekly.data.map((w) => ({ label: shortDate(w.week), value: Number(w.jobs) }))} />}
        </section>
        <section className="panel" style={{ flex: '1 1 380px' }} aria-labelledby="sal-h">
          <h2 id="sal-h">Salary ranges mentioned</h2>
          <p className="small muted">Monthly AED, from postings that list a salary.</p>
          {salaries.loading ? (
            <Loading rows={2} />
          ) : !salaries.data?.length ? (
            <Empty title="Too few postings list a salary yet" />
          ) : (
            <RangeChart width={440} label="Salary range by job title" format={aed} rows={salaries.data.map((s) => ({ label: s.title, low: s.low, high: s.high, tip: `${s.title}: ${aed(s.low)} to ${aed(s.high)} (${s.jobs} jobs)` }))} />
          )}
        </section>
      </div>

      <div className="cols">
        <section className="panel" style={{ flex: '1 1 380px' }} aria-labelledby="funnel-h">
          <h2 id="funnel-h">Your funnel</h2>
          {funnel.loading ? <Loading rows={2} /> : <HBarChart width={440} label="Jobs at each stage" rows={(funnel.data ?? []).map((f) => ({ label: f.stage, value: Number(f.n) }))} />}
        </section>
        <section className="panel" style={{ flex: '1 1 380px' }} aria-labelledby="reply-h">
          <h2 id="reply-h">Reply rate by channel</h2>
          {replies.loading ? (
            <Loading rows={2} />
          ) : !replies.data?.length ? (
            <Empty title="No outreach logged yet" />
          ) : (
            <HBarChart
              width={440}
              label="Share of messages that got a reply"
              format={(n) => `${n}%`}
              rows={replies.data.map((r) => ({ label: r.channel, value: r.sent ? Math.round((Number(r.replied) / Number(r.sent)) * 100) : 0, tip: `${r.channel}: ${r.replied} of ${r.sent} replied` }))}
            />
          )}
        </section>
      </div>
    </>
  );
}
