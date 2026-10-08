import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Layout } from './components/Layout';
import { Empty } from './components/ui';
import { ToastProvider } from './lib/hooks';
import { Link, RouterProvider, matchPath, usePath } from './lib/router';
import { supabase } from './lib/supabase';
import { Insights } from './pages/Insights';
import { JobDetail } from './pages/JobDetail';
import { Jobs } from './pages/Jobs';
import { Outreach } from './pages/Outreach';
import { Pipeline } from './pages/Pipeline';
import { Settings } from './pages/Settings';
import { SignIn } from './pages/SignIn';
import { Today } from './pages/Today';

function Routes() {
  const path = usePath();
  const job = matchPath('/jobs/:id', path);
  if (job) return <JobDetail id={job.id!} />;
  switch (path) {
    case '/':
      return <Today />;
    case '/jobs':
      return <Jobs />;
    case '/pipeline':
      return <Pipeline />;
    case '/outreach':
      return <Outreach />;
    case '/insights':
      return <Insights />;
    case '/settings':
      return <Settings />;
    default:
      return (
        <Empty title="This page doesn't exist">
          <Link to="/">Go to Today</Link>
        </Empty>
      );
  }
}

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  return (
    <RouterProvider>
      <ToastProvider>
        {session ? (
          <Layout email={session.user.email ?? null}>
            <Routes />
          </Layout>
        ) : (
          <SignIn />
        )}
      </ToastProvider>
    </RouterProvider>
  );
}
