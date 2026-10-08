import { useEffect, useState } from 'react';
import { jobFeed, setDismissed, type JobFilters } from '../lib/api';
import { useAction, useAsync } from '../lib/hooks';
import { Empty, ErrorBox, JobRow, Loading } from '../components/ui';

const CITIES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Al Ain'];
const PAGE = 20;

export function Jobs() {
  const [f, setF] = useState<JobFilters>({ view: 'new', sort: 'score', page: 0, pageSize: PAGE, minScore: 0, passedOnly: true });
  const [search, setSearch] = useState('');
  // Wait for a pause in typing before searching.
  useEffect(() => {
    const t = window.setTimeout(() => setF((x) => ({ ...x, search, page: 0 })), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const feed = useAsync(() => jobFeed(f), [JSON.stringify(f)]);
  const act = useAction();
  const set = (patch: Partial<JobFilters>) => setF((x) => ({ ...x, ...patch, page: 0 }));
  const total = feed.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Jobs</h1>
          <p className="muted">{total} jobs. Each opening appears once, even if several sites posted it.</p>
        </div>
        <div className="segmented" role="group" aria-label="Sort">
          <button aria-pressed={f.sort === 'score'} onClick={() => set({ sort: 'score' })}>
            Best match
          </button>
          <button aria-pressed={f.sort === 'newest'} onClick={() => set({ sort: 'newest' })}>
            Newest
          </button>
        </div>
      </header>

      <section className="panel toolbar" aria-label="Filters">
        <div className="field" style={{ flex: '2 1 240px' }}>
          <label htmlFor="q">Search titles</label>
          <input id="q" className="input" type="search" placeholder="e.g. backend, java" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label htmlFor="view">Show</label>
          <select id="view" className="input" value={f.view} onChange={(e) => set({ view: e.target.value as JobFilters['view'] })}>
            <option value="new">Not dismissed</option>
            <option value="dismissed">Dismissed</option>
            <option value="all">Everything</option>
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label htmlFor="city">City</label>
          <select id="city" className="input" value={f.city ?? ''} onChange={(e) => set({ city: e.target.value || undefined })}>
            <option value="">Any UAE city</option>
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 160px' }}>
          <label htmlFor="min">Minimum score: {f.minScore ?? 0}</label>
          <input id="min" type="range" min={0} max={100} step={5} value={f.minScore ?? 0} onChange={(e) => set({ minScore: Number(e.target.value) })} style={{ minHeight: 44, accentColor: 'var(--action)' }} />
        </div>
        <label className="check">
          <input type="checkbox" checked={Boolean(f.hideResidentsOnly)} onChange={(e) => set({ hideResidentsOnly: e.target.checked })} />
          Hide “UAE residents only”
        </label>
        <label className="check">
          <input type="checkbox" checked={!f.passedOnly} onChange={(e) => set({ passedOnly: !e.target.checked })} />
          Include jobs your rules filtered out
        </label>
      </section>

      <section className="panel">
        <ErrorBox error={feed.error ?? act.error} />
        {feed.loading ? (
          <Loading rows={6} />
        ) : feed.data!.rows.length === 0 ? (
          <Empty title="No jobs match these filters">Try a lower minimum score or another city.</Empty>
        ) : (
          <ul className="list">
            {feed.data!.rows.map((m) => (
              <li key={m.id}>
                <JobRow
                  match={m}
                  action={
                    <button
                      className="btn btn-small"
                      disabled={act.busy}
                      onClick={() => act.run(() => setDismissed(m.id, !m.dismissed_at), m.dismissed_at ? 'Restored' : 'Dismissed').then((ok) => ok && feed.reload())}
                    >
                      {m.dismissed_at ? 'Restore' : 'Dismiss'}
                    </button>
                  }
                />
                {!m.prefilter_passed && <p className="xs muted" style={{ marginTop: 6, paddingLeft: 72 }}>Filtered out: {m.prefilter_reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {pages > 1 && (
        <nav className="toolbar" aria-label="Pages" style={{ justifyContent: 'space-between' }}>
          <span className="small muted">
            Page {f.page + 1} of {pages}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" disabled={f.page === 0} onClick={() => setF((x) => ({ ...x, page: x.page - 1 }))}>
              Previous
            </button>
            <button className="btn" disabled={f.page + 1 >= pages} onClick={() => setF((x) => ({ ...x, page: x.page + 1 }))}>
              Next
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
