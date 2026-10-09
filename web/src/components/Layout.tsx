import type { ReactNode } from 'react';
import { aiUsageToday, followUpsDue } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { Link, usePath } from '../lib/router';
import { supabase } from '../lib/supabase';

const NAV = [
  { to: '/', label: 'Today' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/outreach', label: 'Outreach' },
  { to: '/insights', label: 'Insights' },
  { to: '/settings', label: 'Settings' },
];

export function Logo() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="var(--action)" />
      <path d="M8 19 L20 9 M14 9 H20 V15" fill="none" stroke="var(--action-ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 22.5 H17 M8 26 H23" stroke="var(--action-ink)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Layout({ children, email }: { children: ReactNode; email: string | null }) {
  const path = usePath();
  const due = useAsync(followUpsDue, [path]);
  const usage = useAsync(aiUsageToday, [path]);
  const active = (to: string) => (to === '/' ? path === '/' : path.startsWith(to));

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <Link to="/" className="brand">
          <Logo />
          <span className="brand-name">Unslog</span>
        </Link>
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} className="nav-link" aria-current={active(n.to) ? 'page' : undefined}>
            {n.label}
            {n.to === '/pipeline' && (due.data?.length ?? 0) > 0 && (
              <span className="nav-count" aria-label={`${due.data!.length} follow-ups due`}>
                {due.data!.length}
              </span>
            )}
          </Link>
        ))}
        <div className="sidebar-foot">
          <span className="xs muted">AI calls today: {usage.data ?? 0}</span>
          {email && <span className="xs muted" title={email}>{email}</span>}
          <button className="btn btn-small btn-quiet" style={{ justifySelf: 'start', paddingLeft: 0 }} onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </nav>
      <main className="main" id="main">
        {children}
      </main>
    </div>
  );
}
