'use client';
import { useEffect, useMemo, useState } from 'react';
import { LAB_REFERENCE } from '@/lib/labReference';

// Prometric-style lab values reference sheet, opened from the question screen.
export default function LabValuesPanel({ onClose }) {
  const [q, setQ] = useState('');
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return LAB_REFERENCE;
    return LAB_REFERENCE.map((g) => ({ ...g, rows: g.rows.filter((r) => r[0].toLowerCase().includes(s)) })).filter((g) => g.rows.length);
  }, [q]);

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal labs-modal" role="dialog" aria-label="Lab values reference" onClick={(e) => e.stopPropagation()}>
        <div className="actions" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>Lab values</h2>
          <span className="spacer" />
          <button className="btn sm ghost" onClick={onClose}>Close (Esc)</button>
        </div>
        <input
          type="text"
          autoFocus
          placeholder="Search e.g. potassium, TSH, PaCO₂…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search lab values"
        />
        <div className="labs-scroll">
          {groups.map((g) => (
            <div key={g.group}>
              <div className="section-title" style={{ margin: '14px 0 6px' }}>{g.group}</div>
              <table className="labs labs-ref">
                <tbody>
                  {g.rows.map(([name, si, conv]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td><strong>{si}</strong>{conv && <span className="muted"> · {conv}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {!groups.length && <p className="muted" style={{ marginTop: 12 }}>No matching tests.</p>}
        </div>
        <p className="small muted" style={{ margin: '10px 0 0' }}>
          Typical adult ranges; laboratories differ. If a question gives its own reference range, use that.
        </p>
      </div>
    </div>
  );
}
