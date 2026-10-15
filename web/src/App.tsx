import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Layout, Logo } from './components/Layout';
import { Empty } from './components/ui';
import { captureGmailConnection, profile as fetchProfile } from './lib/api';
import { ToastProvider, useAsync } from './lib/hooks';
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
import { Welcome } from './pages/Welcome';

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

/** Shown every sign-in. "Get started" drops into the settings form only when the profile
 *  still needs one; an already-onboarded user skips straight to the dashboard. */
function Onboarding({ profileComplete, onDone }: { profileComplete: boolean; onDone: () => void }) {
  const [step, setStep] = useState<'welcome' | 'form'>('welcome');
  if (step === 'welcome') return <Welcome onGetStarted={() => (profileComplete ? onDone() : setStep('form'))} />;
  return (
    <div className="onboarding-shell">
      <div className="brand">
        <Logo />
        <span className="brand-name">Unslog</span>
      </div>
      <div className="onboarding-form">
        <Settings onSaved={onDone} />
      </div>
    </div>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [pastWelcome, setPastWelcome] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) setPastWelcome(false);
      // provider_refresh_token only ever appears in this one callback, right after OAuth
      // completes — Supabase doesn't store it, so this is the only chance to save it.
      if (s?.provider_refresh_token) captureGmailConnection(s).catch(console.error);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const loadedProfile = useAsync(() => (session ? fetchProfile() : Promise.resolve(null)), [session?.user.id]);

  if (session === undefined) return null;
  return (
    <RouterProvider>
      <ToastProvider>
        {!session ? (
          <SignIn />
        ) : loadedProfile.loading ? null : !pastWelcome ? (
          <Onboarding profileComplete={!!loadedProfile.data?.full_name} onDone={() => setPastWelcome(true)} />
        ) : (
          <Layout email={session.user.email ?? null}>
            <Routes />
          </Layout>
        )}
      </ToastProvider>
    </RouterProvider>
  );
}
