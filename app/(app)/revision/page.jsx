import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import StartSessionButton from '@/components/StartSession';

export const metadata = { title: 'Revision' };
export const dynamic = 'force-dynamic';

const BOXES = [
  [1, 'Just missed', 'due immediately'],
  [2, 'Learning', 'every 3 days'],
  [3, 'Improving', 'every week'],
  [4, 'Nearly there', 'every 2 weeks'],
  [5, 'Mastered', 'monthly'],
];

export default async function RevisionPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [{ count: due }, { count: flagged }, { data: boxes }] = await Promise.all([
    supabase.from('user_question_state').select('question_id', { count: 'exact', head: true }).gt('srs_box', 0).lte('due_at', nowIso),
    supabase.from('user_question_state').select('question_id', { count: 'exact', head: true }).eq('is_flagged', true),
    supabase.from('user_question_state').select('srs_box').gt('srs_box', 0),
  ]);
  const perBox = Object.fromEntries(BOXES.map(([b]) => [b, (boxes || []).filter((r) => r.srs_box === b).length]));
  const inPool = due + flagged;

  return (
    <main className="container narrow">
      <div className="page-head">
        <div>
          <h1>Revision</h1>
          <p>Questions you got wrong come back soonest. Each time you get one right, it comes back less often.</p>
        </div>
      </div>

      <div className="grid grid-4">
        <div className="card stat"><div className="label">Due now</div><div className="value">{due || 0}</div></div>
        <div className="card stat"><div className="label">Flagged</div><div className="value">{flagged || 0}</div></div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Start a revision set</h2>
        <p className="muted">Includes every question that is due plus everything you have flagged, weakest first (up to 50).</p>
        {inPool ? (
          <StartSessionButton args={{ p_mode: 'revision', p_count: 50 }} label="Start revision set" />
        ) : (
          <p>Nothing to revise yet — <Link href="/qbank">answer some questions</Link> first. Anything you get wrong will appear here.</p>
        )}
      </div>

      <div className="card">
        <h2>Your spaced-repetition boxes</h2>
        <div className="table-wrap">
          <table className="list">
            <thead><tr><th>Box</th><th>Stage</th><th>Comes back</th><th>Questions</th></tr></thead>
            <tbody>
              {BOXES.map(([b, name, when]) => (
                <tr key={b}><td>{b}</td><td>{name}</td><td className="muted">{when}</td><td>{perBox[b]}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
