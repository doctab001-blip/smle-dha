import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { EXAM_LABELS } from '@/lib/constants';
import StartSessionButton from '@/components/StartSession';

export const metadata = { title: 'Mock exams' };
export const dynamic = 'force-dynamic';

export default async function MockPage() {
  const supabase = await createClient();
  const [{ data: formatsRaw }, { data: open }, { data: profile }] = await Promise.all([
    supabase.from('mock_formats').select('*').order('question_count', { ascending: false }),
    supabase.from('study_sessions').select('id, mock_format, started_at, expires_at').eq('mode', 'mock').eq('status', 'in_progress').order('started_at', { ascending: false }),
    supabase.from('users').select('target_exam').maybeSingle(),
  ]);
  const myExam = profile?.target_exam;
  // your exam's format first; every format stays available
  const formats = [...(formatsRaw || [])].sort((x, y) => (y.exam === myExam) - (x.exam === myExam));
  const available = await Promise.all(
    (formats || []).map((f) =>
      supabase.from('questions').select('id', { count: 'exact', head: true }).contains('exam_targets', [f.exam])
    )
  );

  return (
    <main className="container narrow">
      <div className="page-head">
        <div>
          <h1>Timed mock exams</h1>
          <p>A strict timer runs for the whole block. Answers and explanations are revealed only after you submit.</p>
        </div>
      </div>

      {open?.length > 0 && (
        <div className="alert warn">
          You have {open.length} unfinished mock{open.length > 1 ? 's' : ''}.{' '}
          {open.map((o) => (
            <Link key={o.id} href={`/session/${o.id}`} style={{ marginRight: 10 }}>Resume {o.mock_format?.replace('_', ' ').toUpperCase()} →</Link>
          ))}
        </div>
      )}

      <div className="grid grid-2">
        {(formats || []).map((f, i) => {
          const have = available[i].count || 0;
          return (
            <div className="card" key={f.code}>
              <span className="pill brand">{EXAM_LABELS[f.exam]}</span>
              {f.exam === myExam && <span className="pill good" style={{ marginLeft: 6 }}>Your exam</span>}
              <h2 style={{ marginTop: 10 }}>{f.label}</h2>
              <p className="muted">
                {f.question_count} questions · {Math.floor(f.duration_minutes / 60)} h {f.duration_minutes % 60 ? `${f.duration_minutes % 60} min` : ''}
              </p>
              {have < f.question_count && (
                <div className="alert info small">
                  The bank currently has {have} {EXAM_LABELS[f.exam]} question{have === 1 ? '' : 's'}, so this block will contain {have} until more are added. The timer still runs for the full duration.
                </div>
              )}
              <StartSessionButton args={{ p_mode: 'mock', p_mock_format: f.code }} label="Start timed block" disabled={have === 0} />
            </div>
          );
        })}
      </div>
    </main>
  );
}
