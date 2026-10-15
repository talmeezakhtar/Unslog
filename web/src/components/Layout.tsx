import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Briefcase, KanbanSquare, SlidersHorizontal, SquareCheckBig, Send, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { aiUsageToday, followUpsDue } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { Link, usePath } from '../lib/router';
import { supabase } from '../lib/supabase';

const NAV: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: '/', label: 'Today', icon: SquareCheckBig },
  { to: '/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { to: '/outreach', label: 'Outreach', icon: Send },
  { to: '/insights', label: 'Insights', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: SlidersHorizontal },
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
            <n.icon className="nav-link-icon" size={18} aria-hidden="true" />
            <span className="nav-link-label">{n.label}</span>
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
        <AnimatePresence mode="wait">
          <motion.div
            key={path}
            initial={{ opacity: 0, y: 6, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ display: 'grid', gap: 'var(--space-5)', minWidth: 0 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
