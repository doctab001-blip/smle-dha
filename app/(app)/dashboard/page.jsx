import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SUBJECTS } from '@/lib/constants';
import Radar from '@/components/Radar';
import SessionsTable from '@/components/SessionsTable';
import WeakTopics from '@/components/WeakTopics';
import { WEAK_THRESHOLD } from '@/lib/constants';

export const metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [perfRes, pctRes, cohortRes, dueRes, flagRes, sessRes, profRes, topicRes] = await Promise.all([
    supabase.from('v_my_subject_performance').select('*'),
    supabase.rpc('get_my_percentile'),
    supabase.rpc('get_cohort_subject_accuracy'),
    supabase.from('user_question_state').select('question_id', { count: 'exact', head: true }).gt('srs_box', 0).lte('due_at', nowIso),
    supabase.from('user_question_state').select('question_id', { count: 'exact', head: true }).eq('is_flagged', true),
    supabase.from('study_sessions').select('id, mode, mock_format, status, started_at, expires_at, score_correct, score_total, question_ids').order('started_at', { ascending: false }).limit(8),
    supabase.from('users').select('full_name').maybeSingle(),
    supabase.from('v_my_topic_performance').select('*'),
  ]);

  const perf = perfRes.data || [];
  const pct = pctRes.data || {};
  const cohortMap = Object.fromEntries((cohortRes.data || []).map((r) => [r.subject_category, Number(r.accuracy_pct)]));
  const perfMap = Object.fromEntries(perf.map((r) => [r.subject_category, r]));
  const due = dueRes.count || 0;
  const flagged = flagRes.count || 0;
  const sessions = sessRes.data || [];
  const name = profRes.data?.full_name;
  const topics = topicRes.data || [];

  const answered = pct.answered || 0;
  const accuracy = pct.accuracy_pct;
  const hasCohort = Object.keys(cohortMap).length > 0;

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <h1>{name ? `Welcome back, ${name.split(' ')[0]}` : 'Your dashboard'}</h1>
          <p>Track your progress across all six subjects.</p>
        </div>
        <div className="actions">
          <Link href="/qbank" className="btn">Start practising</Link>
          <Link href="/mock" className="btn secondary">Take a mock</Link>
        </div>
      </div>

      <div className="grid grid-4">
        <div className="card stat">
          <div className="label">Questions answered</div>
          <div className="value">{answered}</div>
          <div className="sub">across all modes</div>
        </div>
        <div className="card stat">
          <div className="label">Overall accuracy</div>
          <div className="value">{accuracy != null ? `${accuracy}%` : '—'}</div>
          <div className="sub">{answered ? 'of graded answers' : 'answer a few questions to start'}</div>
        </div>
        <div className="card stat">
          <div className="label">Percentile rank</div>
          <div className="value">{pct.percentile != null ? `${pct.percentile}th` : '—'}</div>
          <div className="sub">
            {pct.percentile != null
              ? `vs ${pct.cohort_size} candidates`
              : `unlocks after ${pct.min_for_rank ?? 50} answers`}
          </div>
        </div>
        <div className="card stat">
          <div className="label">Due for revision</div>
          <div className="value">{due}</div>
          <div className="sub">
            {due ? <Link href="/revision">Start revision set →</Link> : `${flagged} flagged`}
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Strengths &amp; weaknesses</h2>
          <Radar
            axes={SUBJECTS.map((s) => s.short)}
            mine={SUBJECTS.map((s) => Number(perfMap[s.slug]?.accuracy_pct ?? 0))}
            cohort={hasCohort ? SUBJECTS.map((s) => cohortMap[s.slug] ?? 0) : null}
          />
          <div className="legend" style={{ justifyContent: 'center' }}>
            <span><i style={{ background: 'rgba(13,148,136,0.35)', borderColor: '#0d9488' }} />You</span>
            {hasCohort && <span><i style={{ background: 'rgba(123,133,149,0.15)', borderColor: '#9aa3b0' }} />All users</span>}
          </div>
        </div>

        <div className="card">
          <h2>By subject</h2>
          <div className="subject-row muted small" style={{ fontWeight: 600 }}>
            <span>Subject</span><span>Answered</span><span>Accuracy</span>
          </div>
          {SUBJECTS.map((s) => {
            const row = perfMap[s.slug];
            const acc = row?.accuracy_pct != null ? Number(row.accuracy_pct) : null;
            return (
              <div className="subject-row" key={s.slug}>
                <span>
                  {s.name}
                  {acc != null && acc < WEAK_THRESHOLD && (row?.answered ?? 0) >= 3 && <span className="pill bad" style={{ marginLeft: 6 }}>Weak</span>}
                </span>
                <span className="muted">{row?.answered ?? 0}</span>
                <span>
                  {acc != null ? (
                    <>
                      <span className="small">{acc}%</span>
                      <span className="bar" style={{ display: 'block', marginTop: 4 }}><i style={{ width: `${acc}%`, background: acc >= 60 ? 'var(--good)' : acc >= 40 ? 'var(--warn)' : 'var(--bad)' }} /></span>
                    </>
                  ) : (
                    <span className="muted small">—</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <WeakTopics topics={topics} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Recent sessions</h2>
        {sessions.length ? <SessionsTable sessions={sessions} /> : (
          <p className="muted">No sessions yet. <Link href="/qbank">Start your first question set →</Link></p>
        )}
      </div>
    </main>
  );
}
