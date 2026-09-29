'use client';
import { useState } from 'react';
import { useStartSession } from '@/components/StartSession';

export default function QBankForm({ subjects }) {
  const [selected, setSelected] = useState(() => subjects.filter((s) => s.count > 0).map((s) => s.slug));
  const [count, setCount] = useState(20);
  const [exam, setExam] = useState('');
  const [unseen, setUnseen] = useState(false);
  const { start, busy, error } = useStartSession();

  const toggle = (slug) =>
    setSelected((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]));
  const allOn = selected.length === subjects.length;

  return (
    <div className="card">
      <div className="section-title">Subjects</div>
      <div className="chips" style={{ marginBottom: 10 }}>
        {subjects.map((s) => (
          <label key={s.slug} className={`chip ${selected.includes(s.slug) ? 'on' : ''}`}>
            <input type="checkbox" checked={selected.includes(s.slug)} onChange={() => toggle(s.slug)} />
            {s.name} <span className="muted small">({s.count})</span>
          </label>
        ))}
      </div>
      <button type="button" className="btn sm ghost" onClick={() => setSelected(allOn ? [] : subjects.map((s) => s.slug))}>
        {allOn ? 'Clear all' : 'Select all'}
      </button>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginTop: 20 }}>
        <label className="field">
          <span>Number of questions</span>
          <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Exam</span>
          <select value={exam} onChange={(e) => setExam(e.target.value)}>
            <option value="">Any</option>
            <option value="smle">SMLE (Saudi Arabia)</option>
            <option value="dha">DHA (Dubai)</option>
            <option value="doh">DOH (Abu Dhabi)</option>
            <option value="mohap">MOHAP (UAE)</option>
          </select>
        </label>
      </div>
      <label className="chip" style={{ marginBottom: 20 }}>
        <input type="checkbox" checked={unseen} onChange={(e) => setUnseen(e.target.checked)} />
        Only questions I haven&apos;t answered before
      </label>

      {error && <div className="alert error">{error}</div>}
      <div className="actions">
        <button
          className="btn"
          disabled={busy || selected.length === 0}
          onClick={() =>
            start({
              p_mode: 'tutor',
              p_subjects: selected,
              p_count: count,
              p_exam: exam || null,
              p_unseen_only: unseen,
            })
          }
        >
          {busy ? 'Preparing…' : 'Start questions'}
        </button>
        <span className="muted small">Shortcuts in a session: <span className="kbd">A</span>–<span className="kbd">E</span> choose, <span className="kbd">Enter</span> submit / next</span>
      </div>
    </div>
  );
}
