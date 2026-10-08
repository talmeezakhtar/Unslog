import { applications, setApplicationStatus } from '../lib/api';
import { ago } from '../lib/format';
import { useAction, useAsync } from '../lib/hooks';
import { Link } from '../lib/router';
import { STATUS_LABEL, type Application, type ApplicationStatus } from '../lib/types';
import { ErrorBox, Loading } from '../components/ui';

const LANES: Array<{ status: ApplicationStatus | 'closed'; hint: string }> = [
  { status: 'saved', hint: 'Shortlisted, not applied yet' },
  { status: 'applied', hint: 'Waiting for a reply' },
  { status: 'follow_up_due', hint: 'Quiet for too long: send a nudge' },
  { status: 'interview', hint: 'Rounds scheduled or done' },
  { status: 'offer', hint: 'Offer received' },
  { status: 'closed', hint: 'Rejected or withdrawn' },
];

const inLane = (a: Application, lane: ApplicationStatus | 'closed') =>
  lane === 'closed' ? a.status === 'rejected' || a.status === 'withdrawn' : a.status === lane;

export function Pipeline() {
  const apps = useAsync(applications);
  const act = useAction();
  const all = apps.data ?? [];
  const applied = all.filter((a) => a.applied_at).length;
  const interviews = all.filter((a) => ['interview', 'offer'].includes(a.status)).length;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Pipeline</h1>
          <p className="muted">Every job you're pursuing, by stage. Change a card's stage with its menu.</p>
        </div>
        <p className="small muted">
          {applied} applied, {interviews} at interview or offer{applied > 0 ? ` (${Math.round((interviews / applied) * 100)}%)` : ''}
        </p>
      </header>
      <ErrorBox error={apps.error ?? act.error} />
      {apps.loading ? (
        <Loading rows={3} />
      ) : all.length === 0 ? (
        <section className="panel">
          <p>
            Nothing here yet. Save or apply to jobs from <Link to="/">Today</Link> or <Link to="/jobs">Jobs</Link> and they'll show up here.
          </p>
        </section>
      ) : (
        <div className="board">
          {LANES.map((lane) => {
            const cards = all.filter((a) => inLane(a, lane.status));
            return (
              <section key={lane.status} className={`lane ${lane.status === 'follow_up_due' && cards.length ? 'attention' : ''}`} aria-label={lane.status === 'closed' ? 'Closed' : STATUS_LABEL[lane.status]}>
                <div className="lane-head">
                  <h2 style={{ fontSize: 'var(--text-md)' }}>{lane.status === 'closed' ? 'Closed' : STATUS_LABEL[lane.status]}</h2>
                  <span className="small muted">{cards.length}</span>
                </div>
                <p className="xs muted" style={{ padding: '0 4px' }}>
                  {lane.hint}
                </p>
                {cards.map((a) => (
                  <article key={a.id} className="card">
                    <Link to={`/jobs/${a.job_id}`} className="job-title" style={{ fontSize: '0.95rem' }}>
                      {a.job?.title ?? 'Job'}
                    </Link>
                    <span className="small muted">{a.job?.company?.name}</span>
                    <span className="xs muted">{a.applied_at ? `Applied ${ago(a.applied_at)}` : `Updated ${ago(a.updated_at)}`}</span>
                    {a.status === 'follow_up_due' && (
                      <button className="btn btn-small btn-primary" disabled={act.busy} onClick={() => act.run(() => setApplicationStatus(a.job_id, 'applied'), 'Marked as followed up').then((ok) => ok && apps.reload())}>
                        I followed up
                      </button>
                    )}
                    <label className="visually-hidden" htmlFor={`st-${a.id}`}>
                      Stage for {a.job?.title}
                    </label>
                    <select
                      id={`st-${a.id}`}
                      className="input"
                      style={{ minHeight: 36 }}
                      value={a.status}
                      disabled={act.busy}
                      onChange={(e) => act.run(() => setApplicationStatus(a.job_id, e.target.value as ApplicationStatus), 'Stage updated').then((ok) => ok && apps.reload())}
                    >
                      {(Object.keys(STATUS_LABEL) as ApplicationStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
