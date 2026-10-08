import { useEffect, useState } from 'react';
import { contacts, jobsForOutreach, logOutreach, outreachDraft, outreachLog, setOutreachStatus } from '../lib/api';
import { ago, safeUrl } from '../lib/format';
import { useAction, useAsync } from '../lib/hooks';
import { Link } from '../lib/router';
import type { OutreachChannel } from '../lib/types';
import { Empty, ErrorBox, Loading, copyText } from '../components/ui';

const CHANNELS: Array<{ value: OutreachChannel; label: string; limit?: number }> = [
  { value: 'linkedin', label: 'LinkedIn note', limit: 300 },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'other', label: 'Other' },
];
const STATUS_TEXT = { sent: 'Waiting', replied: 'Replied', no_reply: 'No reply' } as const;

export function Outreach() {
  const params = new URLSearchParams(window.location.search);
  const people = useAsync(contacts);
  const log = useAsync(outreachLog);
  const jobs = useAsync(jobsForOutreach);
  const act = useAction();

  const [contactId, setContactId] = useState(params.get('contact') ?? '');
  const [jobId, setJobId] = useState(params.get('job') ?? '');
  const [channel, setChannel] = useState<OutreachChannel>('linkedin');
  const [message, setMessage] = useState('');
  const [edited, setEdited] = useState(false);
  const limit = CHANNELS.find((c) => c.value === channel)?.limit;
  const contact = people.data?.find((c) => c.id === contactId);

  // Start from the AI outreach draft for that job, with the person's first name filled in.
  // Never overwrites what you've typed.
  useEffect(() => {
    if (!jobId || edited) return;
    let cancelled = false;
    outreachDraft(jobId).then((d) => {
      if (d && !cancelled) setMessage(d.replace('[Name]', contact?.name.split(' ')[0] ?? '[Name]'));
    });
    return () => {
      cancelled = true;
    };
  }, [jobId, contact?.name, edited]);

  const sent = log.data ?? [];
  const replied = sent.filter((o) => o.status === 'replied').length;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Outreach</h1>
          <p className="muted">A short note to the right person often beats another portal application.</p>
        </div>
        <p className="small muted">
          {sent.length} sent, {replied} replied{sent.length ? ` (${Math.round((replied / sent.length) * 100)}%)` : ''}
        </p>
      </header>

      <div className="cols">
        <section className="panel wide" aria-labelledby="log-h">
          <h2 id="log-h">Messages you've sent</h2>
          <ErrorBox error={log.error ?? act.error} />
          {log.loading ? (
            <Loading rows={4} />
          ) : sent.length === 0 ? (
            <Empty title="No messages logged yet">Add people from a job's page, write a note here, send it yourself, then log it.</Empty>
          ) : (
            <div className="table-wrap" style={{ border: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>About</th>
                    <th>Sent</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sent.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <strong>{o.contact?.name}</strong>
                        <div className="xs muted">
                          {[o.contact?.role, o.contact?.company?.name].filter(Boolean).join(', ')}
                        </div>
                      </td>
                      <td>{o.job ? <Link to={`/jobs/${o.job.id}`}>{o.job.title}</Link> : <span className="muted">General</span>}</td>
                      <td className="muted">
                        {ago(o.sent_at)} by {CHANNELS.find((c) => c.value === o.channel)?.label}
                      </td>
                      <td>
                        <label className="visually-hidden" htmlFor={`os-${o.id}`}>
                          Status for {o.contact?.name}
                        </label>
                        <select id={`os-${o.id}`} className="input" style={{ minHeight: 36, width: 'auto' }} value={o.status} onChange={(e) => act.run(() => setOutreachStatus(o.id, e.target.value as 'sent'), 'Updated').then((ok) => ok && log.reload())}>
                          {Object.entries(STATUS_TEXT).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel narrow" aria-labelledby="compose-h" style={{ display: 'grid' }}>
          <h2 id="compose-h">Write a message</h2>
          {(people.data?.length ?? 0) === 0 && !people.loading ? (
            <p className="small muted">Add people from a job's page first ("People at …").</p>
          ) : (
            <form
              style={{ display: 'grid', gap: 12 }}
              onSubmit={(e) => {
                e.preventDefault();
                act.run(() => logOutreach({ contact_id: contactId, job_id: jobId || null, channel, message }), 'Logged as sent').then((ok) => {
                  if (ok) {
                    setMessage('');
                    setEdited(false);
                    log.reload();
                  }
                });
              }}
            >
              <div className="field">
                <label htmlFor="o-person">To</label>
                <select id="o-person" className="input" required value={contactId} onChange={(e) => setContactId(e.target.value)}>
                  <option value="">Choose a person</option>
                  {people.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.company ? `, ${c.company.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="o-job">About</label>
                <select id="o-job" className="input" value={jobId} onChange={(e) => setJobId(e.target.value)}>
                  <option value="">No specific job</option>
                  {jobId && jobs.data && !jobs.data.some((j) => j.id === jobId) && <option value={jobId}>The job you came from</option>}
                  {jobs.data?.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                      {j.company ? `, ${j.company}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="o-channel">Channel</label>
                <select id="o-channel" className="input" value={channel} onChange={(e) => setChannel(e.target.value as OutreachChannel)}>
                  {CHANNELS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="o-msg">Message</label>
                <textarea
                  id="o-msg"
                  className="input"
                  rows={7}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    setEdited(true);
                  }}
                />
                <span className={`xs ${limit && message.length > limit ? '' : 'muted'}`} style={limit && message.length > limit ? { color: 'var(--danger)' } : undefined}>
                  {message.length}
                  {limit ? ` / ${limit} characters` : ' characters'}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button type="button" className="btn" disabled={!message} onClick={() => act.run(() => copyText(message), 'Copied')}>
                  Copy
                </button>
                {safeUrl(contact?.linkedin_url) && (
                  <a className="btn" href={safeUrl(contact?.linkedin_url)} target="_blank" rel="noopener noreferrer">
                    Open LinkedIn
                  </a>
                )}
                <button type="submit" className="btn btn-primary" disabled={!contactId || !message || act.busy}>
                  Log as sent
                </button>
              </div>
              <p className="xs muted">You send the message yourself. Callback only keeps track of it.</p>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
