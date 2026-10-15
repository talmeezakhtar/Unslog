import { useEffect, useState } from 'react';
import {
  addContact,
  addInterview,
  jobDetail,
  saveDraft,
  setApplicationStatus,
  setDismissed,
  setInterviewOutcome,
  updateApplicationNotes,
  type JobDetail as Detail,
} from '../lib/api';
import { VISA_LABEL, ago, dateTime, modelLabel, safeUrl, shortDate, sourceNames } from '../lib/format';
import { useAction, useAsync } from '../lib/hooks';
import { Link } from '../lib/router';
import { STATUS_LABEL, type ApplicationStatus, type DraftType, type Interview } from '../lib/types';
import { Empty, ErrorBox, Loading, Score, copyText } from '../components/ui';

const INTERVIEW_LABEL: Record<Interview['type'], string> = { hr: 'HR screen', technical: 'Technical', final: 'Final', other: 'Other' };

const DRAFT_TABS: Array<{ type: DraftType; label: string; hint: string }> = [
  { type: 'cover_note', label: 'Cover note', hint: 'About 120 words, using the job’s own keywords' },
  { type: 'outreach', label: 'Outreach note', hint: 'LinkedIn note, under 300 characters' },
  { type: 'follow_up', label: 'Follow-up', hint: 'For when an application goes quiet' },
];

export function JobDetail({ id, onClose }: { id: string; onClose?: () => void }) {
  const d = useAsync(() => jobDetail(id), [id]);
  if (d.loading) return <Loading rows={5} />;
  if (d.error || !d.data) return <ErrorBox error={d.error ?? 'Job not found'} />;
  return <DetailView d={d.data} reload={d.reload} showBackLink={!onClose} />;
}

function DetailView({ d, reload, showBackLink }: { d: Detail; reload: () => void; showBackLink: boolean }) {
  const act = useAction();
  const { job, match, application } = d;
  const sources = job.sightings ?? [];
  const mainUrl = sources.map((s) => safeUrl(s.url)).find(Boolean);

  return (
    <>
      {showBackLink && (
        <Link to="/jobs" className="small">
          Back to jobs
        </Link>
      )}

      <section className="panel" aria-labelledby="job-h">
        <div className="job-row" style={{ alignItems: 'flex-start' }}>
          <Score value={match?.score ?? null} size="lg" label="fit" />
          <div className="body" style={{ gap: 8 }}>
            <h1 id="job-h" style={{ fontSize: 'var(--text-xl)' }}>
              {job.title}
            </h1>
            <div className="meta">
              <span>{job.company?.name ?? 'Company not listed'}</span>
              {job.city && <span>{job.city}</span>}
              {job.salary_text && <span>{job.salary_text}</span>}
              <span>{job.posted_at ? `posted ${ago(job.posted_at)}` : `found ${ago(job.first_seen_at)}`}</span>
            </div>
            <div className="tags">
              {sourceNames(sources).map((s) => (
                <span className="tag" key={s}>
                  Seen on {s}
                </span>
              ))}
              {job.visa_flags.map((f) => (
                <span key={f} className={`tag ${f === 'residents_only' ? 'tag-attention' : 'tag-good'}`}>
                  {VISA_LABEL[f] ?? f}
                </span>
              ))}
              {application && <span className="tag tag-good">{STATUS_LABEL[application.status]}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {match && (
              <button className="btn" disabled={act.busy} onClick={() => act.run(() => setDismissed(match.id, !match.dismissed_at), match.dismissed_at ? 'Restored' : 'Dismissed').then((ok) => ok && reload())}>
                {match.dismissed_at ? 'Restore' : 'Dismiss'}
              </button>
            )}
            {mainUrl && (
              <a className="btn" href={mainUrl} target="_blank" rel="noopener noreferrer">
                Open job posting
              </a>
            )}
            {!application || application.status === 'saved' ? (
              <button className="btn btn-primary" disabled={act.busy} onClick={() => act.run(() => setApplicationStatus(job.id, 'applied', 'portal'), 'Marked as applied').then((ok) => ok && reload())}>
                Mark as applied
              </button>
            ) : (
              <>
                {application.status === 'follow_up_due' && (
                  <button className="btn btn-primary" disabled={act.busy} onClick={() => act.run(() => setApplicationStatus(job.id, 'applied'), 'Marked as followed up').then((ok) => ok && reload())}>
                    I followed up
                  </button>
                )}
                <StatusSelect jobId={job.id} status={application.status} onDone={reload} />
              </>
            )}
          </div>
        </div>
        <ErrorBox error={act.error} />
      </section>

      <div className="cols">
        <div className="narrow" style={{ flex: '1 1 380px' }}>
          <section className="panel" aria-labelledby="fit-h">
            <div className="panel-head">
              <h2 id="fit-h">Why it fits</h2>
              {match?.model && <span className="xs muted">{modelLabel(match.model)}</span>}
            </div>
            {match ? (
              <>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>
                  {(match.reasons.length ? match.reasons : [match.prefilter_reason ?? '']).filter(Boolean).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                {match.visa_note && <p className="notice small">{match.visa_note}</p>}
                {d.skills.length > 0 && (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <span className="small muted">Skills in this posting</span>
                    <div className="tags">
                      {d.skills.map((s) => (
                        <span className="tag" key={s}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {match.missing_skills.length > 0 && (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <span className="small muted">Skills you might be missing</span>
                    <div className="tags">
                      {match.missing_skills.map((s) => (
                        <span className="tag tag-missing" key={s}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="small muted">Not matched against your profile yet. It will be on the next run.</p>
            )}
          </section>

          <section className="panel" aria-labelledby="desc-h">
            <h2 id="desc-h">Job description</h2>
            {job.description ? <div className="description">{job.description}</div> : <p className="muted small">No description from this source. Open the posting to read it.</p>}
            {!job.description_is_full && job.description && <p className="xs muted">This is a snippet. The full text is on the original posting.</p>}
          </section>
        </div>

        <div className="narrow" style={{ flex: '1 1 380px' }}>
          <Drafts d={d} onSaved={reload} />
          <Contacts d={d} onAdded={reload} />
          {application && <ApplicationPanel d={d} onChange={reload} />}
        </div>
      </div>
    </>
  );
}

function StatusSelect({ jobId, status, onDone }: { jobId: string; status: ApplicationStatus; onDone: () => void }) {
  const act = useAction();
  return (
    <div className="field">
      <label htmlFor="status" className="visually-hidden">
        Application status
      </label>
      <select id="status" className="input" value={status} disabled={act.busy} onChange={(e) => act.run(() => setApplicationStatus(jobId, e.target.value as ApplicationStatus), 'Status updated').then((ok) => ok && onDone())}>
        {(Object.keys(STATUS_LABEL) as ApplicationStatus[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </div>
  );
}

function Drafts({ d, onSaved }: { d: Detail; onSaved: () => void }) {
  const [tab, setTab] = useState<DraftType>('cover_note');
  const current = d.drafts.find((x) => x.type === tab);
  const [text, setText] = useState(current?.content ?? '');
  useEffect(() => setText(current?.content ?? ''), [current?.content, tab]);
  const act = useAction();
  const meta = DRAFT_TABS.find((t) => t.type === tab)!;
  const changed = text !== (current?.content ?? '');

  return (
    <section className="panel" aria-labelledby="drafts-h">
      <h2 id="drafts-h">Drafts</h2>
      <div
        className="tabs"
        role="tablist"
        aria-label="Draft type"
        onKeyDown={(e) => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          const i = DRAFT_TABS.findIndex((t) => t.type === tab);
          const next = DRAFT_TABS[(i + (e.key === 'ArrowRight' ? 1 : DRAFT_TABS.length - 1)) % DRAFT_TABS.length]!;
          setTab(next.type);
          document.getElementById(`tab-${next.type}`)?.focus();
        }}
      >
        {DRAFT_TABS.map((t) => (
          <button key={t.type} role="tab" id={`tab-${t.type}`} aria-selected={tab === t.type} tabIndex={tab === t.type ? 0 : -1} aria-controls="draft-panel" onClick={() => setTab(t.type)}>
            {t.label}
          </button>
        ))}
      </div>
      <div id="draft-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} style={{ display: 'grid', gap: 8 }}>
        <label htmlFor="draft" className="small muted">
          {meta.hint}.
          {current?.model && ` Written by ${modelLabel(current.model)}${current.edited_by_user ? ', edited by you' : ''}.`}
        </label>
        <textarea id="draft" className="input" rows={9} value={text} placeholder="No draft yet. Drafts are written for your top jobs on each run, or write your own here." onChange={(e) => setText(e.target.value)} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="xs muted">{text.length} characters</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" disabled={!changed || act.busy} onClick={() => act.run(() => saveDraft(d.job.id, tab, text), 'Draft saved').then((ok) => ok && onSaved())}>
              Save edits
            </button>
            <button className="btn btn-primary" disabled={!text} onClick={() => act.run(() => copyText(text), 'Copied')}>
              Copy
            </button>
          </div>
        </div>
        <ErrorBox error={act.error} />
      </div>
    </section>
  );
}

function Contacts({ d, onAdded }: { d: Detail; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', linkedin_url: '' });
  const act = useAction();
  const company = d.job.company;
  if (!company) return null;

  return (
    <section className="panel" aria-labelledby="people-h">
      <h2 id="people-h">People at {company.name}</h2>
      {d.contacts.length === 0 ? (
        <p className="small muted">No one yet. Search LinkedIn for a recruiter or an engineer on this team, then add them here.</p>
      ) : (
        <ul className="list">
          {d.contacts.map((c) => (
            <li key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div>
                <strong>{c.name}</strong>
                <div className="small muted">{c.role}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {safeUrl(c.linkedin_url) && (
                  <a className="btn btn-small" href={safeUrl(c.linkedin_url)} target="_blank" rel="noopener noreferrer">
                    LinkedIn
                  </a>
                )}
                <Link className="btn btn-small" to={`/outreach?contact=${c.id}&job=${d.job.id}`}>
                  Message
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <form
          style={{ display: 'grid', gap: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            act
              .run(() => addContact({ name: form.name, role: form.role || null, linkedin_url: form.linkedin_url || null, email: null, company_id: company.id, how_found: 'LinkedIn' }), 'Contact added')
              .then((ok) => {
                if (ok) {
                  setForm({ name: '', role: '', linkedin_url: '' });
                  setOpen(false);
                  onAdded();
                }
              });
          }}
        >
          <div className="form-grid">
            <div className="field">
              <label htmlFor="c-name">Name</label>
              <input id="c-name" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="c-role">Role</label>
              <input id="c-role" className="input" placeholder="Talent acquisition" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="c-li">LinkedIn profile URL</label>
            <input id="c-li" className="input" type="url" value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" type="submit" disabled={act.busy}>
              Add contact
            </button>
            <button className="btn btn-quiet" type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
          <ErrorBox error={act.error} />
        </form>
      ) : (
        <button className="btn" onClick={() => setOpen(true)}>
          Add a contact
        </button>
      )}
    </section>
  );
}

function ApplicationPanel({ d, onChange }: { d: Detail; onChange: () => void }) {
  const app = d.application!;
  const [notes, setNotes] = useState(app.notes ?? '');
  const [iv, setIv] = useState<{ type: Interview['type']; scheduled_at: string }>({ type: 'hr', scheduled_at: '' });
  const act = useAction();

  return (
    <section className="panel" aria-labelledby="app-h">
      <div className="panel-head">
        <h2 id="app-h">Your application</h2>
        {app.next_follow_up_at && <span className="small muted">Follow up {shortDate(app.next_follow_up_at)}</span>}
      </div>
      <ol className="timeline" aria-label="History">
        {d.events.map((e, i) => (
          <li key={i}>
            <span className="muted">{shortDate(e.at)}</span>
            <span>{STATUS_LABEL[e.to_status as ApplicationStatus] ?? e.to_status}</span>
          </li>
        ))}
      </ol>

      <div className="field">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div>
        <button className="btn btn-small" disabled={notes === (app.notes ?? '') || act.busy} onClick={() => act.run(() => updateApplicationNotes(app.id, notes), 'Notes saved').then((ok) => ok && onChange())}>
          Save notes
        </button>
      </div>

      <h3>Interviews</h3>
      {d.interviews.length === 0 ? (
        <p className="small muted">None logged yet.</p>
      ) : (
        <ul className="list">
          {d.interviews.map((i) => (
            <li key={i.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <span>
                Round {i.round}: {INTERVIEW_LABEL[i.type]}
                <span className="small muted"> {dateTime(i.scheduled_at)}</span>
              </span>
              <select className="input" style={{ width: 'auto' }} aria-label={`Outcome of round ${i.round}`} value={i.outcome} onChange={(e) => act.run(() => setInterviewOutcome(i.id, e.target.value as Interview['outcome']), 'Outcome saved').then((ok) => ok && onChange())}>
                <option value="pending">Pending</option>
                <option value="passed">Passed</option>
                <option value="failed">Not progressed</option>
              </select>
            </li>
          ))}
        </ul>
      )}
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          act
            .run(async () => {
              await addInterview(app.id, { round: d.interviews.length + 1, type: iv.type, scheduled_at: iv.scheduled_at ? new Date(iv.scheduled_at).toISOString() : null, notes: null });
              if (app.status !== 'interview') await setApplicationStatus(d.job.id, 'interview');
            }, 'Interview added')
            .then((ok) => ok && onChange());
        }}
      >
        <div className="field">
          <label htmlFor="iv-type">Type</label>
          <select id="iv-type" className="input" value={iv.type} onChange={(e) => setIv({ ...iv, type: e.target.value as Interview['type'] })}>
            <option value="hr">HR screen</option>
            <option value="technical">Technical</option>
            <option value="final">Final</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="iv-when">When</label>
          <input id="iv-when" className="input" type="datetime-local" value={iv.scheduled_at} onChange={(e) => setIv({ ...iv, scheduled_at: e.target.value })} />
        </div>
        <button className="btn" type="submit" disabled={act.busy}>
          Add interview
        </button>
      </form>
      <ErrorBox error={act.error} />
      {d.interviews.length === 0 && d.events.length === 0 && <Empty title="No history yet" />}
    </section>
  );
}
