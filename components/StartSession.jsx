'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Button that calls the start_session RPC and navigates to the new session.
export function useStartSession() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function start(args) {
    setBusy(true);
    setError('');
    const { data, error } = await createClient().rpc('start_session', args);
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push(`/session/${data}`);
  }
  return { start, busy, error };
}

export default function StartSessionButton({ args, label, className = 'btn', disabled }) {
  const { start, busy, error } = useStartSession();
  return (
    <>
      <button className={className} disabled={busy || disabled} onClick={() => start(args)}>
        {busy ? 'Preparing…' : label}
      </button>
      {error && <div className="alert error" style={{ marginTop: 10 }}>{error}</div>}
    </>
  );
}
