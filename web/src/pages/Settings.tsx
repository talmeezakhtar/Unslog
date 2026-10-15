import { useEffect, useState } from 'react';
import { addSavedSearch, profile, removeSavedSearch, requestGmailAccess, saveProfile, savedSearches, saveSecrets, secrets, sources } from '../lib/api';
import { ago } from '../lib/format';
import { useAction, useAsync } from '../lib/hooks';
import { signInWithGmail } from '../lib/supabase';
import type { Profile, Secrets, TargetCompany } from '../lib/types';
import { ChipInput, ErrorBox, Loading } from '../components/ui';

const EMPTY: Omit<Profile, 'user_id'> = {
  full_name: '',
  headline: '',
  skills: [],
  years_experience: 0,
  target_titles: [],
  cities: ['Dubai', 'Abu Dhabi', 'Sharjah'],
  visa_status: 'visit',
  cv_text: '',
  highlight_project: '',
  must_have: [],
  blocked_words: [],
  min_score: 60,
  max_ai_jobs_per_day: 30,
  follow_up_days: 6,
  target_companies: [],
  digest_channel: 'none',
  digest_email: '',
  telegram_chat_id: '',
  gmail_connected: false,
};

const EMPTY_SECRETS: Secrets = { jooble_api_key: '', gemini_api_key: '', groq_api_key: '' };

const ATS: Array<{ value: TargetCompany['ats']; label: string; example: string }> = [
  { value: 'greenhouse', label: 'Greenhouse', example: 'boards.greenhouse.io/<slug>' },
  { value: 'lever', label: 'Lever', example: 'jobs.lever.co/<slug>' },
  { value: 'ashby', label: 'Ashby', example: 'jobs.ashbyhq.com/<slug>' },
  { value: 'workable', label: 'Workable', example: 'apply.workable.com/<slug>' },
  { value: 'smartrecruiters', label: 'SmartRecruiters', example: 'jobs.smartrecruiters.com/<slug>' },
];

export function Settings({ onSaved }: { onSaved?: () => void } = {}) {
  const loaded = useAsync(profile);
  const [p, setP] = useState<Omit<Profile, 'user_id'>>(EMPTY);
  useEffect(() => {
    if (loaded.data) {
      const { user_id: _ignored, ...rest } = loaded.data;
      setP({ ...EMPTY, ...rest });
    }
  }, [loaded.data]);
  const save = useAction();
  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => setP((x) => ({ ...x, [k]: v }));

  if (loaded.loading) return <Loading rows={6} />;

  return (
    <form
      style={{ display: 'grid', gap: 'var(--space-5)' }}
      onSubmit={(e) => {
        e.preventDefault();
        save.run(() => saveProfile(p), 'Settings saved').then((ok) => {
          if (!ok) return;
          loaded.reload();
          onSaved?.();
        });
      }}
    >
      <header className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted">Your profile and rules decide which jobs reach you. Changes apply from the next run.</p>
        </div>
        <button className="btn btn-primary" type="submit" disabled={save.busy}>
          Save changes
        </button>
      </header>
      <ErrorBox error={loaded.error ?? save.error} />

      <Connections gmailConnected={p.gmail_connected} />

      <section className="panel" aria-labelledby="profile-h">
        <h2 id="profile-h">Profile</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input id="name" className="input" value={p.full_name ?? ''} onChange={(e) => set('full_name', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="years">Years of experience</label>
            <input id="years" className="input" type="number" min={0} max={40} value={p.years_experience} onChange={(e) => set('years_experience', Number(e.target.value))} />
          </div>
          <div className="field">
            <label htmlFor="visa">Visa status</label>
            <select id="visa" className="input" value={p.visa_status} onChange={(e) => set('visa_status', e.target.value as Profile['visa_status'])}>
              <option value="visit">Visit visa (need a sponsor)</option>
              <option value="resident">UAE residence visa</option>
              <option value="needs_sponsorship">Outside the UAE, need sponsorship</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="headline">One line about you (used in drafts)</label>
          <input id="headline" className="input" placeholder="Backend developer with Node.js and NestJS internship experience" value={p.headline ?? ''} onChange={(e) => set('headline', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="skills">Skills (press Enter after each)</label>
          <ChipInput id="skills" values={p.skills} onChange={(v) => set('skills', v)} placeholder="Node.js, Java, React…" />
        </div>
        <div className="field">
          <label htmlFor="titles">Target job titles</label>
          <ChipInput id="titles" values={p.target_titles} onChange={(v) => set('target_titles', v)} placeholder="Backend developer, Full stack developer" />
        </div>
        <div className="field">
          <label htmlFor="cities">Cities</label>
          <ChipInput id="cities" values={p.cities} onChange={(v) => set('cities', v)} placeholder="Dubai" />
        </div>
        <div className="field">
          <label htmlFor="project">A project drafts can mention</label>
          <input id="project" className="input" placeholder="a carpet design configurator (bunakar.vercel.app)" value={p.highlight_project ?? ''} onChange={(e) => set('highlight_project', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="cv">CV text (paste it; used for scoring and drafts)</label>
          <textarea id="cv" className="input" rows={6} value={p.cv_text ?? ''} onChange={(e) => set('cv_text', e.target.value)} />
        </div>
      </section>

      <section className="panel" aria-labelledby="rules-h">
        <h2 id="rules-h">Filter rules</h2>
        <p className="small muted">Checked with plain code before any AI call, so they cost nothing.</p>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="must">Must mention at least one of</label>
            <ChipInput id="must" values={p.must_have} onChange={(v) => set('must_have', v)} placeholder="Leave empty to allow all" />
          </div>
          <div className="field">
            <label htmlFor="blocked">Skip jobs that mention</label>
            <ChipInput id="blocked" values={p.blocked_words} onChange={(v) => set('blocked_words', v)} placeholder="Arabic speaker, 10+ years" />
          </div>
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="minscore">Draft for jobs scoring at least: {p.min_score}</label>
            <input id="minscore" type="range" min={0} max={100} step={5} value={p.min_score} onChange={(e) => set('min_score', Number(e.target.value))} style={{ minHeight: 44, accentColor: 'var(--action)' }} />
          </div>
          <div className="field">
            <label htmlFor="cap">AI-scored jobs per day</label>
            <input id="cap" className="input" type="number" min={0} max={500} value={p.max_ai_jobs_per_day} onChange={(e) => set('max_ai_jobs_per_day', Number(e.target.value))} />
          </div>
          <div className="field">
            <label htmlFor="fu">Follow up after (days)</label>
            <input id="fu" className="input" type="number" min={1} max={60} value={p.follow_up_days} onChange={(e) => set('follow_up_days', Number(e.target.value))} />
          </div>
        </div>
      </section>

      <Companies value={p.target_companies} onChange={(v) => set('target_companies', v)} />
      <Searches />

      <section className="panel" aria-labelledby="digest-h">
        <h2 id="digest-h">Morning digest</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="channel">Send it by</label>
            <select id="channel" className="input" value={p.digest_channel === 'email' ? 'none' : p.digest_channel} onChange={(e) => set('digest_channel', e.target.value as Profile['digest_channel'])}>
              <option value="none">Don't send</option>
              <option value="telegram">Telegram</option>
            </select>
          </div>
          {p.digest_channel === 'telegram' && (
            <div className="field">
              <label htmlFor="tg">Telegram chat id</label>
              <input id="tg" className="input" inputMode="numeric" value={p.telegram_chat_id ?? ''} onChange={(e) => set('telegram_chat_id', e.target.value)} />
            </div>
          )}
        </div>
        <p className="xs muted">Message your bot once, then get your chat id from @userinfobot. Email digests are off for everyone right now — they'd otherwise go out through one shared Gmail account.</p>
      </section>

      <Sources />

      <div>
        <button className="btn btn-primary" type="submit" disabled={save.busy}>
          Save changes
        </button>
      </div>
    </form>
  );
}

function Companies({ value, onChange }: { value: TargetCompany[]; onChange: (v: TargetCompany[]) => void }) {
  const [draft, setDraft] = useState<TargetCompany>({ ats: 'greenhouse', slug: '', name: '' });
  const example = ATS.find((a) => a.value === draft.ats)!.example;
  return (
    <section className="panel" aria-labelledby="co-h">
      <h2 id="co-h">Target companies</h2>
      <p className="small muted">
        Companies whose careers page runs on a public job board. Open their careers page; if the address looks like {example}, add the slug.
      </p>
      {value.length > 0 && (
        <ul className="list">
          {value.map((c) => (
            <li key={`${c.ats}:${c.slug}`} className="health" style={{ alignItems: 'center' }}>
              <span>
                <strong>{c.name || c.slug}</strong> <span className="muted small">{ATS.find((a) => a.value === c.ats)?.label}</span>
              </span>
              <button type="button" className="btn btn-small" onClick={() => onChange(value.filter((x) => !(x.ats === c.ats && x.slug === c.slug)))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="toolbar">
        <div className="field">
          <label htmlFor="ats">Job board</label>
          <select id="ats" className="input" value={draft.ats} onChange={(e) => setDraft({ ...draft, ats: e.target.value as TargetCompany['ats'] })}>
            {ATS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="slug">Slug</label>
          <input id="slug" className="input" placeholder="acme" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value.trim() })} />
        </div>
        <div className="field">
          <label htmlFor="coname">Company name</label>
          <input id="coname" className="input" placeholder="Acme" value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <button
          type="button"
          className="btn"
          disabled={!draft.slug}
          onClick={() => {
            onChange([...value.filter((x) => !(x.ats === draft.ats && x.slug === draft.slug)), { ...draft, name: draft.name || undefined }]);
            setDraft({ ...draft, slug: '', name: '' });
          }}
        >
          Add company
        </button>
      </div>
      <p className="xs muted">Remember to save changes.</p>
    </section>
  );
}

function Connections({ gmailConnected }: { gmailConnected: boolean }) {
  const loaded = useAsync(secrets);
  const [s, setS] = useState<Secrets>(EMPTY_SECRETS);
  useEffect(() => {
    if (loaded.data) setS({ ...EMPTY_SECRETS, ...loaded.data });
  }, [loaded.data]);
  const save = useAction();
  const connect = useAction();
  const request = useAction();
  const [requestEmail, setRequestEmail] = useState('');

  return (
    <section className="panel" aria-labelledby="conn-h">
      <h2 id="conn-h">Connections</h2>
      <ErrorBox error={loaded.error ?? save.error ?? connect.error ?? request.error} />

      <div className="health">
        <span>
          <span className={`dot ${gmailConnected ? 'ok' : ''}`} aria-hidden="true" />
          Gmail {gmailConnected ? '— connected' : '— not connected'}
        </span>
        <button type="button" className="btn btn-small" disabled={connect.busy} onClick={() => connect.run(async () => { const { error } = await signInWithGmail(); if (error) throw new Error(error.message); })}>
          {gmailConnected ? 'Reconnect' : 'Connect Gmail'}
        </button>
      </div>
      <p className="xs muted">Reads job-alert emails (Indeed, LinkedIn, Bayt, Naukrigulf). Reconnect here if it ever stops finding new mail. Limited beta: only approved Google accounts can connect right now.</p>

      {!gmailConnected && (
        <div className="form-grid" style={{ marginTop: '0.5rem' }}>
          <div className="field">
            <label htmlFor="gmail-request">Not approved yet? Leave your Google account email and we'll add you</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="gmail-request"
                className="input"
                type="email"
                placeholder="you@gmail.com"
                value={requestEmail}
                onChange={(e) => setRequestEmail(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-small"
                disabled={request.busy || !requestEmail.trim()}
                onClick={() => request.run(() => requestGmailAccess(requestEmail.trim()), 'Request sent')}
              >
                Request access
              </button>
            </div>
          </div>
        </div>
      )}

      <hr className="divider" />

      <div className="form-grid">
        <div className="field">
          <label htmlFor="jooble-key">Jooble API key (optional)</label>
          <input id="jooble-key" className="input" value={s.jooble_api_key ?? ''} onChange={(e) => setS({ ...s, jooble_api_key: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="gemini-key">Gemini API key (optional)</label>
          <input id="gemini-key" className="input" value={s.gemini_api_key ?? ''} onChange={(e) => setS({ ...s, gemini_api_key: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="groq-key">Groq API key (optional fallback)</label>
          <input id="groq-key" className="input" value={s.groq_api_key ?? ''} onChange={(e) => setS({ ...s, groq_api_key: e.target.value })} />
        </div>
      </div>
      <p className="xs muted">
        Free keys: Jooble at jooble.org/api/about, Gemini at aistudio.google.com/apikey, Groq at console.groq.com/keys. Without
        these, Unslog still runs on email alerts alone and scores with the free heuristic instead of AI.
      </p>
      <button type="button" className="btn" disabled={save.busy} onClick={() => save.run(() => saveSecrets(s), 'Keys saved')}>
        Save keys
      </button>
    </section>
  );
}

function Searches() {
  const list = useAsync(savedSearches);
  const [keywords, setKeywords] = useState('');
  const act = useAction();
  return (
    <section className="panel" aria-labelledby="search-h">
      <h2 id="search-h">Jooble searches</h2>
      <p className="small muted">Keyword searches Unslog runs across UAE job sites. Without any, it searches your target job titles.</p>
      <ErrorBox error={list.error ?? act.error} />
      {(list.data?.length ?? 0) > 0 && (
        <ul className="list">
          {list.data!.map((s) => (
            <li key={s.id} className="health" style={{ alignItems: 'center' }}>
              <span>
                {s.keywords} <span className="small muted">in {s.location}</span>
              </span>
              <button type="button" className="btn btn-small" onClick={() => act.run(() => removeSavedSearch(s.id), 'Search removed').then((ok) => ok && list.reload())}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="toolbar">
        <div className="field" style={{ flex: '1 1 260px' }}>
          <label htmlFor="kw">Keywords</label>
          <input id="kw" className="input" placeholder="node.js developer" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        </div>
        <button type="button" className="btn" disabled={!keywords.trim() || act.busy} onClick={() => act.run(() => addSavedSearch(keywords.trim(), 'United Arab Emirates'), 'Search added').then((ok) => ok && (setKeywords(''), list.reload()))}>
          Add search
        </button>
      </div>
    </section>
  );
}

function Sources() {
  const list = useAsync(sources);
  return (
    <section className="panel" aria-labelledby="src-h">
      <h2 id="src-h">Connected sources</h2>
      <p className="small muted">Sources are switched on by adding their keys to the pipeline (see the setup guide). This list shows how each one last ran.</p>
      {list.loading ? (
        <Loading rows={2} />
      ) : (list.data?.length ?? 0) === 0 ? (
        <p className="small muted">No sources have run yet.</p>
      ) : (
        <ul className="list">
          {list.data!.map((s) => (
            <li key={s.key} className="health">
              <span>
                <span className={`dot ${s.last_error ? 'failed' : s.last_success_at ? 'ok' : ''}`} aria-hidden="true" />
                {s.name}
              </span>
              <span className="muted" title={s.last_error ?? undefined}>
                {s.last_error ? 'Last run failed' : s.last_success_at ? `OK ${ago(s.last_success_at)}` : 'Not run yet'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
