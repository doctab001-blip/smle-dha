import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SUBJECTS } from '@/lib/constants';
import Radar from '@/components/Radar';
import SessionsTable from '@/components/SessionsTable';
import WeakTopics from '@/components/WeakTopics';
import { WEAK_THRESHOLD } from '@/lib/constants';
import ExamSwitcher from '@/components/ExamSwitcher';
import StartSessionButton from '@/components/StartSession';
import { EXAMS, isExam } from '@/lib/exams';

export const metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function Dashboard({ searchParams }) {
  const { exam: examParam } = await searchParams;
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data: { user } } = await supabase.auth.getUser();

  // Active exam context (users.target_exam). Arriving from /smle or /dha via ?exam= switches it.
  let { data: profile } = await supabase.from('users').select('full_name, target_exam').eq('id', user.id).maybeSingle();
  if (isExam(examParam) && profile && profile.target_exam !== examParam) {
    await supabase.from('users').update({ target_exam: examParam }).eq('id', user.id);
    profile = { ...profile, target_exam: examParam };
  }
  const examCode = profile?.target_exam || 'smle';
  const exam = EXAMS[examCode] || EXAMS.smle;

  const [perfRes, pctRes, cohortRes, dueRes, flagRes, sessRes, topicRes, mockRes] = await Promise.all([
    supabase.from('v_my_subject_performance').select('*'),
    supabase.rpc('get_my_percentile'),
    supabase.rpc('get_cohort_subject_accuracy'),
    supabase.from('user_question_state').select('question_id', { count: 'exact', head: true }).gt('srs_box', 0).lte('due_at', nowIso),
    supabase.from('user_question_state').select('question_id', { count: 'exact', head: true }).eq('is_flagged', true),
    supabase.from('study_sessions').select('id, mode, mock_format, status, started_at, expires_at, score_correct, score_total, question_ids').order('started_at', { ascending: false }).limit(8),
    supabase.from('v_my_topic_performance').select('*'),
    supabase.from('study_sessions').select('id, started_at, score_correct, score_total').eq('mode', 'mock')
      .eq('mock_format', exam.mockFormat).eq('status', 'submitted').order('started_at', { ascending: false }).limit(20),
  ]);

  const perf = perfRes.data || [];
  const pct = pctRes.data || {};
  const cohortMap = Object.fromEntries((cohortRes.data || []).map((r) => [r.subject_category, Number(r.accuracy_pct)]));
  const perfMap = Object.fromEntries(perf.map((r) => [r.subject_category, r]));
  const due = dueRes.count || 0;
  const flagged = flagRes.count || 0;
  const sessions = sessRes.data || [];
  const name = profile?.full_name;
  const mocks = (mockRes.data || []).filter((m) => m.score_total);
  const mockPct = (m) => Math.round((100 * m.score_correct) / m.score_total);
  const bestMock = mocks.length ? Math.max(...mocks.map(mockPct)) : null;
  const topics = topicRes.data || [];

  const answered = pct.answered || 0;
  const accuracy = pct.accuracy_pct;
  const hasCohort = Object.keys(cohortMap).length > 0;

  return (
    <main className="container">
      <div className="page-head">
        <div>
          <h1>{name ? `Welcome back, ${name.split(' ')[0]}` : 'Your dashboard'}</h1>
          <p>{exam.name} preparation · all six subjects are open.</p>
        </div>
        <div className="actions">
          <ExamSwitcher userId={user.id} current={examCode} />
          <Link href="/qbank" className="btn">Start practising</Link>
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

      <div className="card exam-panel" style={{ marginTop: 16 }}>
        <div className="actions">
          <div>
            <div className="section-title" style={{ marginBottom: 4 }}>{exam.short} mock exam · {exam.country}</div>
            <h2 style={{ margin: 0 }}>{exam.mockQuestions}-question timed block</h2>
            <p className="muted small" style={{ margin: '4px 0 0' }}>
              {mocks.length
                ? `${mocks.length} ${exam.short} mock${mocks.length > 1 ? 's' : ''} completed · best ${bestMock}% · last ${mockPct(mocks[0])}%`
                : `You haven't sat ${exam.a} ${exam.short} mock yet. Answers stay hidden until you submit, as in the real exam.`}
            </p>
          </div>
          <span className="spacer" />
          <StartSessionButton args={{ p_mode: 'mock', p_mock_format: exam.mockFormat }} label={`Start ${exam.short} mock`} />
          <Link href="/mock" className="btn ghost">All mock formats</Link>
        </div>
        {mocks.length > 1 && (
          <div className="mock-trend" aria-label={`${exam.short} mock scores, oldest to newest`}>
            {[...mocks].reverse().slice(-10).map((m) => (
              <div key={m.id} className="mock-bar" title={`${new Date(m.started_at).toLocaleDateString('en-GB')}: ${mockPct(m)}%`}>
                <i style={{ height: `${Math.max(4, mockPct(m))}%`, background: mockPct(m) >= 60 ? 'var(--good)' : 'var(--bad)' }} />
                <span>{mockPct(m)}</span>
              </div>
            ))}
          </div>
        )}
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
