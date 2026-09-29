'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get('error') || '');
  const [info, setInfo] = useState('');
  const next = params.get('next') || '/dashboard';

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    const supabase = createClient();
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        if (data.session) {
          router.replace('/dashboard');
          router.refresh();
        } else {
          setInfo('Account created. Check your inbox for a confirmation link, then come back and sign in.');
          setMode('signin');
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card auth-card">
      <div className="tabs" role="tablist">
        <button className={mode === 'signin' ? 'on' : ''} onClick={() => setMode('signin')} type="button">Sign in</button>
        <button className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')} type="button">Create account</button>
      </div>
      {error && <div className="alert error">{error}</div>}
      {info && <div className="alert info">{info}</div>}
      <form onSubmit={submit}>
        {mode === 'signup' && (
          <label className="field">
            <span>Full name</span>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        </label>
        <button className="btn" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
