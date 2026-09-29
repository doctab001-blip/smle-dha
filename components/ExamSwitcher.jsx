'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { EXAMS } from '@/lib/exams';

// Dashboard header dropdown: switch the active exam context (SMLE ⇄ DHA).
// Only changes which mock and analytics are highlighted — no content is ever locked.
export default function ExamSwitcher({ userId, current }) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);

  async function change(e) {
    const next = e.target.value;
    setValue(next);
    setBusy(true);
    const { error } = await createClient().from('users').update({ target_exam: next }).eq('id', userId);
    setBusy(false);
    if (error) { setValue(current); return; }
    router.refresh();
  }

  return (
    <label className="exam-context">
      <span className="small muted">Preparing for</span>
      <select value={value} onChange={change} disabled={busy} aria-label="Active exam">
        {Object.values(EXAMS).map((x) => <option key={x.code} value={x.code}>{x.short} — {x.country}</option>)}
        {!EXAMS[value] && <option value={value}>{value.toUpperCase()}</option>}
      </select>
    </label>
  );
}
