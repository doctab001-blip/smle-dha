import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { subjectName } from '@/lib/constants';
import StartSessionButton from '@/components/StartSession';

export const metadata = { title: 'Flagged & notes' };
export const dynamic = 'force-dynamic';

export default async function FlaggedPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('user_question_state')
    .select('question_id, is_flagged, note, last_correct, updated_at, questions(text, subject_category)')
    .or('is_flagged.eq.true,note.not.is.null')
    .order('updated_at', { ascending: false });

  const flaggedCount = (rows || []).filter((r) => r.is_flagged).length;

  return (
    <main className="container narrow">
      <div className="page-head">
        <div>
          <h1>Flagged questions &amp; your notes</h1>
          <p>Questions you flagged for review, and every question you wrote a note on.</p>
        </div>
        {flaggedCount > 0 && <StartSessionButton args={{ p_mode: 'revision', p_count: 50 }} label="Revise flagged + due" />}
      </div>

      {!rows?.length ? (
        <div className="card"><p className="muted" style={{ margin: 0 }}>Nothing here yet. Use <strong>Flag for review</strong> or write a note while answering questions. <Link href="/qbank">Go to the question bank →</Link></p></div>
      ) : (
        rows.map((r) => (
          <div className="card" key={r.question_id}>
            <div className="qmeta" style={{ marginBottom: 8 }}>
              <span className="pill">{subjectName(r.questions?.subject_category)}</span>
              {r.is_flagged && <span className="pill warn">Flagged</span>}
              {r.last_correct === true && <span className="pill good">Last: correct</span>}
              {r.last_correct === false && <span className="pill bad">Last: incorrect</span>}
            </div>
            <p style={{ fontFamily: 'var(--read)' }}>
              {(r.questions?.text || '').slice(0, 220)}{(r.questions?.text || '').length > 220 ? '…' : ''}
            </p>
            {r.note && (
              <div className="alert info" style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                <strong>Your note:</strong> {r.note}
              </div>
            )}
          </div>
        ))
      )}
    </main>
  );
}
