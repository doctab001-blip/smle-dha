import Link from 'next/link';

const MODE_LABEL = { tutor: 'Tutor', mock: 'Mock exam', revision: 'Revision' };

function fmtDate(iso) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' });
}

export default function SessionsTable({ sessions }) {
  return (
    <div className="table-wrap">
      <table className="list">
        <thead>
          <tr><th>Started</th><th>Type</th><th>Questions</th><th>Score</th><th /></tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const done = s.status === 'submitted';
            const pct = done && s.score_total ? Math.round((100 * s.score_correct) / s.score_total) : null;
            const expired = s.mode === 'mock' && !done && s.expires_at && new Date(s.expires_at) < new Date();
            return (
              <tr key={s.id}>
                <td>{fmtDate(s.started_at)}</td>
                <td>
                  {MODE_LABEL[s.mode]}
                  {s.mock_format && <span className="muted small"> · {s.mock_format.replace('_', ' ').toUpperCase()}</span>}
                </td>
                <td>{s.question_ids?.length ?? 0}</td>
                <td>
                  {done ? (
                    <span className={`pill ${pct >= 60 ? 'good' : 'bad'}`}>{s.score_correct}/{s.score_total} · {pct ?? 0}%</span>
                  ) : expired ? (
                    <span className="pill warn">Time up — not submitted</span>
                  ) : (
                    <span className="pill brand">In progress</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <Link href={`/session/${s.id}`} className="btn sm ghost">{done ? 'Review' : 'Resume'}</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
