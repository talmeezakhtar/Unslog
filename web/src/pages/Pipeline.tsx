import { useState } from 'react';
import { GripVertical } from 'lucide-react';
import { applications, setApplicationStatus } from '../lib/api';
import { ago } from '../lib/format';
import { useAction, useAsync } from '../lib/hooks';
import { Link } from '../lib/router';
import { STATUS_LABEL, type Application, type ApplicationStatus } from '../lib/types';
import { ErrorBox, initials, Loading } from '../components/ui';

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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropLane, setDropLane] = useState<ApplicationStatus | 'closed' | null>(null);
  const all = apps.data ?? [];
  const applied = all.filter((a) => a.applied_at).length;
  const interviews = all.filter((a) => ['interview', 'offer'].includes(a.status)).length;

  const moveTo = (app: Application, lane: ApplicationStatus | 'closed') => {
    if (inLane(app, lane)) return;
    // ponytail: dropping into Closed always marks rejected (no drag target to pick withdrawn); use the stage menu to set withdrawn instead.
    const status: ApplicationStatus = lane === 'closed' ? 'rejected' : lane;
    act.run(() => setApplicationStatus(app.job_id, status), 'Stage updated').then((ok) => ok && apps.reload());
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Pipeline</h1>
          <p className="muted">Every job you're pursuing, by stage. Drag a card to move it, or use its stage menu.</p>
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
              <section
                key={lane.status}
                className={`lane ${lane.status === 'follow_up_due' && cards.length ? 'attention' : ''} ${dropLane === lane.status ? 'drop-target' : ''}`}
                aria-label={lane.status === 'closed' ? 'Closed' : STATUS_LABEL[lane.status]}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDropLane(lane.status);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropLane(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropLane(null);
                  // When a move unmounts the card from this lane, the browser can't deliver its
                  // trailing dragend to a detached node, so clear the dragging flag here too.
                  setDraggingId(null);
                  const app = all.find((x) => x.id === e.dataTransfer.getData('text/plain'));
                  if (app) moveTo(app, lane.status);
                }}
              >
                <div className="lane-head">
                  <h2 style={{ fontSize: 'var(--text-md)' }}>{lane.status === 'closed' ? 'Closed' : STATUS_LABEL[lane.status]}</h2>
                  <span className="small muted">{cards.length}</span>
                </div>
                <p className="xs muted" style={{ padding: '0 4px' }}>
                  {lane.hint}
                </p>
                {cards.map((a) => (
                  <article
                    key={a.id}
                    className={`card ${lane.status === 'closed' ? 'card-void' : ''} ${draggingId === a.id ? 'is-dragging' : ''}`}
                    draggable={!act.busy}
                    onDragStart={(e) => {
                      setDraggingId(a.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', a.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDropLane(null);
                    }}
                  >
                    <div className="card-head">
                      <span className="avatar" aria-hidden="true">
                        {initials(a.job?.company?.name)}
                      </span>
                      <div className="card-head-body">
                        <Link to={`/jobs/${a.job_id}`} className="job-title" style={{ fontSize: '0.95rem' }}>
                          {a.job?.title ?? 'Job'}
                        </Link>
                        <span className="small muted">
                          {a.job?.company?.name ?? 'Company not listed'}
                          {a.job?.city ? ` · ${a.job.city}` : ''}
                        </span>
                      </div>
                      <GripVertical className="card-grip" size={16} aria-hidden="true" />
                    </div>
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
