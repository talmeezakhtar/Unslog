import { useState } from 'react';
import { collectorHealth, followUpsDue, profile, setApplicationStatus, todaySummary, topMatches } from '../lib/api';
import { ago, greeting } from '../lib/format';
import { useAction, useAsync } from '../lib/hooks';
import { Link } from '../lib/router';
import { Empty, ErrorBox, JobRow, Loading } from '../components/ui';
import { Modal } from '../components/ui/modal';
import { JobDetail } from './JobDetail';

const COLLECTOR_NAME: Record<string, string> = { gmail: 'Email alerts', jooble: 'Jooble' };
const collectorName = (c: string) => COLLECTOR_NAME[c] ?? (c.startsWith('ats:') ? `${c.split(':')[2]} careers page` : c);

export function Today() {
  const me = useAsync(profile);
  const summary = useAsync(todaySummary);
  const top = useAsync(() => topMatches(10));
  const due = useAsync(followUpsDue);
  const health = useAsync(collectorHealth);
  const save = useAction();
  const [reviewId, setReviewId] = useState<string | null>(null);
  const closeReview = () => {
    setReviewId(null);
    top.reload();
    due.reload();
  };

  const s = summary.data;
  const count = top.data?.length ?? 0;
  const reviewTitle = top.data?.find((m) => m.job.id === reviewId)?.job.title ?? due.data?.find((a) => a.job_id === reviewId)?.job?.title ?? 'Job details';

  if (!me.loading && !me.data) {
    return (
      <section className="panel">
        <h1 className="greeting">Welcome to Unslog</h1>
        <p>Tell Unslog what you're looking for. It uses your skills, cities and visa status to filter and rank jobs every morning.</p>
        <div>
          <Link to="/settings" className="btn btn-primary">
            Set up your profile
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="greeting">
            {greeting(me.data?.full_name)}. {count > 0 ? `${count} jobs are worth your time today.` : 'Nothing new worth your time yet.'}
          </h1>
          <p className="muted">{s?.last_run_at ? `Last checked ${ago(s.last_run_at)} at ${new Date(s.last_run_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'The first run hasn’t happened yet.'}</p>
        </div>
      </header>

      {s && (
        <div className="funnel-strip" aria-label="This morning's funnel">
          <div className="funnel-step">
            <strong>{s.new_jobs_today}</strong>
            <span className="small muted">new jobs found</span>
          </div>
          <div className="funnel-step">
            <strong>{s.passed_today}</strong>
            <span className="small muted">passed your rules</span>
          </div>
          <div className="funnel-step">
            <strong>{s.ai_scored_today}</strong>
            <span className="small muted">scored by AI</span>
          </div>
          <div className="funnel-step">
            <strong>{count}</strong>
            <span className="small muted">for you to review</span>
          </div>
        </div>
      )}

      <div className="cols">
        <section className="panel wide" aria-labelledby="top-h">
          <div className="panel-head">
            <h2 id="top-h">Top matches</h2>
            <Link to="/jobs" className="small">
              See all jobs
            </Link>
          </div>
          <ErrorBox error={top.error ?? save.error} />
          {top.loading ? (
            <Loading rows={4} />
          ) : count === 0 ? (
            <Empty title="No strong matches from the last run">Check that your sources are connected and your filter rules aren't too strict in Settings.</Empty>
          ) : (
            <ul className="list">
              {top.data!.map((m) => (
                <li key={m.id}>
                  <JobRow
                    match={m}
                    onReview={() => setReviewId(m.job.id)}
                    action={
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-small" disabled={save.busy} onClick={() => save.run(() => setApplicationStatus(m.job.id, 'saved'), 'Saved to your pipeline').then((ok) => ok && top.reload())}>
                          Save
                        </button>
                        <button className="btn btn-small btn-primary" onClick={() => setReviewId(m.job.id)}>
                          Review
                        </button>
                      </div>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="narrow">
          <section className="panel" aria-labelledby="due-h">
            <div className="panel-head">
              <h2 id="due-h">Follow-ups due</h2>
              {s && s.interviews_week > 0 && <span className="small muted">{s.interviews_week} {s.interviews_week === 1 ? 'interview' : 'interviews'} this week</span>}
            </div>
            {due.loading ? (
              <Loading rows={2} />
            ) : (due.data?.length ?? 0) === 0 ? (
              <p className="small muted">Nothing to chase today.</p>
            ) : (
              <ul className="list">
                {due.data!.map((a) => (
                  <li key={a.id}>
                    <button type="button" className="job-title" style={{ fontSize: '1rem' }} onClick={() => setReviewId(a.job_id)}>
                      {a.job?.title}
                    </button>
                    <div className="meta">
                      <span>{a.job?.company?.name}</span>
                      <span>applied {ago(a.applied_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel" aria-labelledby="health-h">
            <h2 id="health-h">Sources</h2>
            {health.loading ? (
              <Loading rows={2} />
            ) : (health.data?.length ?? 0) === 0 ? (
              <p className="small muted">No runs yet. The pipeline runs every morning, or start it from GitHub Actions.</p>
            ) : (
              <ul className="list">
                {health.data!.map((r) => (
                  <li key={r.collector} className="health">
                    <span>
                      <span className={`dot ${r.status === 'success' ? 'ok' : r.status}`} aria-hidden="true" />
                      {collectorName(r.collector)}
                    </span>
                    <span className="muted" title={r.error ?? undefined}>
                      {r.status === 'failed' ? 'Failed, see logs' : `${r.new_count} new`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <Modal open={reviewId !== null} onClose={closeReview} title={reviewTitle}>
        {reviewId && <JobDetail id={reviewId} onClose={closeReview} />}
      </Modal>
    </>
  );
}
