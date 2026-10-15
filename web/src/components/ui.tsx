import { X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from '../lib/router';
import { VISA_LABEL, ago, sourceNames } from '../lib/format';
import type { Match } from '../lib/types';

/** Monogram for a company/person name: up to two initials, letters/digits only (handles "AT&T", "H&M"). */
export const initials = (name?: string | null) =>
  (name ?? '')
    .split(' ')
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

/** The score tile: the number, with a fill that rises with the score. */
export function Score({ value, size = 'md', label }: { value: number | null; size?: 'md' | 'lg'; label?: string }) {
  const v = value ?? 0;
  return (
    <div
      className={`score ${size === 'lg' ? 'score-lg' : ''} ${v >= 80 ? 'is-high' : ''}`}
      style={{ ['--score' as string]: v }}
      role="img"
      aria-label={value === null ? 'Not scored yet' : `Fit score ${value} out of 100`}
    >
      <span>
        {value ?? '–'}
        {label && <small>{label}</small>}
      </span>
    </div>
  );
}

export function JobMeta({ match }: { match: Match }) {
  const j = match.job;
  return (
    <div className="meta">
      <span>{j.company?.name ?? 'Company not listed'}</span>
      {j.city && <span>{j.city}</span>}
      <span>{j.posted_at ? `posted ${ago(j.posted_at)}` : `found ${ago(j.first_seen_at)}`}</span>
    </div>
  );
}

export function JobTags({ match }: { match: Match }) {
  const sources = sourceNames(match.job.sightings ?? []);
  const reason = match.reasons?.[0] ?? match.prefilter_reason;
  return (
    <div className="tags">
      {sources.map((s) => (
        <span key={s} className="tag">
          {s}
        </span>
      ))}
      {match.job.visa_flags.map((f) => (
        <span key={f} className={`tag ${f === 'residents_only' ? 'tag-attention' : 'tag-good'}`}>
          {VISA_LABEL[f] ?? f}
        </span>
      ))}
      {reason && <span className="tag">{reason}</span>}
    </div>
  );
}

export function JobRow({ match, action, onReview }: { match: Match; action?: ReactNode; onReview?: () => void }) {
  return (
    <div className="job-row">
      <Score value={match.score} />
      <div className="body">
        {onReview ? (
          <button type="button" className="job-title" onClick={onReview}>
            {match.job.title}
          </button>
        ) : (
          <Link to={`/jobs/${match.job.id}`} className="job-title">
            {match.job.title}
          </Link>
        )}
        <JobMeta match={match} />
        <JobTags match={match} />
      </div>
      {action && <div className="job-row-actions">{action}</div>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <div className="small">{children}</div>}
    </div>
  );
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="error" role="alert">
      {error}
    </p>
  );
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ display: 'grid', gap: 12 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 56 }} />
      ))}
    </div>
  );
}

/** Type a value and press Enter (or comma) to add it; click × to remove. */
export function ChipInput({ id, values, onChange, placeholder }: { id: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) onChange([...new Set([...values, ...parts])]);
    setDraft('');
  };
  return (
    <div className="chip-input">
      {values.map((v) => (
        <span className="chip" key={v}>
          {v}
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && !draft && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={() => draft && add(draft)}
      />
    </div>
  );
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
