'use client';
import Link from 'next/link';
import { useStartSession } from '@/components/StartSession';
import { WEAK_THRESHOLD, WEAK_MIN_ANSWERS } from '@/lib/constants';
export default function WeakTopics({ topics }) {
  const { start, busy, error } = useStartSession();
  const weak = topics
    .filter((t) => t.answered >= WEAK_MIN_ANSWERS && Number(t.accuracy_pct) < WEAK_THRESHOLD)
    .sort((a, b) => Number(a.accuracy_pct) - Number(b.accuracy_pct));

  return (
    <div className="card">
      <div className="actions" style={{ marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>Weak topics</h2>
        <span className="spacer" />
        {weak.length > 0 && (
          <button
            className="btn sm"
            disabled={busy}
            onClick={() => start({ p_mode: 'tutor', p_topic_ids: weak.map((t) => t.topic_id), p_count: 20 })}
          >
            {busy ? 'Preparing…' : 'Re-test weak concepts'}
          </button>
        )}
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>
        Topics where your accuracy is below {WEAK_THRESHOLD}% (after at least {WEAK_MIN_ANSWERS} answers).
      </p>
      {error && <div className="alert error">{error}</div>}
      {weak.length ? (
        <>
          <div className="weak-row muted small" style={{ fontWeight: 600 }}>
            <span>Topic</span><span>Answered</span><span>Accuracy</span>
          </div>
          {weak.map((t) => (
            <div className="weak-row" key={t.topic_id}>
              <span>{t.topic_title} <span className="muted small">· {t.subject_name}</span></span>
              <span className="muted">{t.answered}</span>
              <span><span className="pill bad">{Number(t.accuracy_pct)}%</span></span>
            </div>
          ))}
        </>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {topics.length
            ? 'No weak topics right now — nice work. Keep practising to keep it that way.'
            : <>Answer some questions to see which topics need work. <Link href="/qbank">Start practising →</Link></>}
        </p>
      )}
    </div>
  );
}
