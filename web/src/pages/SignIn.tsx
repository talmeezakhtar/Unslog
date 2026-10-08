import { useState } from 'react';
import { Logo } from '../components/Layout';
import { ErrorBox } from '../components/ui';
import { isConfigured, supabase } from '../lib/supabase';

export function SignIn() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) setError(error.message);
  };

  const magicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <Logo />
        <h1>Fewer applications. More callbacks.</h1>
        <p className="muted">Every morning Callback finds new UAE jobs, ranks them against your profile and drafts what to send. You decide what goes out.</p>
        {!isConfigured && (
          <p className="notice">
            Supabase isn't connected yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env, then restart the dev server. See docs/01-getting-started.md.
          </p>
        )}
        <button className="btn btn-primary" onClick={google} disabled={!isConfigured}>
          Continue with Google
        </button>
        {sent ? (
          <p className="notice" role="status">
            Check {email} for a sign-in link.
          </p>
        ) : (
          <form onSubmit={magicLink} style={{ display: 'grid', gap: 12 }}>
            <div className="field">
              <label htmlFor="email">Or get a sign-in link by email</label>
              <input id="email" className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="btn" type="submit" disabled={!isConfigured || !email}>
              Email me a link
            </button>
          </form>
        )}
        <ErrorBox error={error} />
      </div>
    </div>
  );
}
