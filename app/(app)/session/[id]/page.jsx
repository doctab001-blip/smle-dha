import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { QUESTION_COLUMNS } from '@/lib/constants';
import SessionRunner from '@/components/SessionRunner';

export const metadata = { title: 'Session' };
export const dynamic = 'force-dynamic';

export default async function SessionPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: session } = await supabase
    .from('study_sessions')
    .select('id, mode, mock_format, status, question_ids, started_at, expires_at, time_limit_seconds, score_correct, score_total')
    .eq('id', id)
    .maybeSingle();
  if (!session) notFound();

  const ids = session.question_ids || [];
  const [{ data: qs }, { data: review }, { data: states }, { data: responses }] = await Promise.all([
    supabase.from('questions').select(QUESTION_COLUMNS).in('id', ids),
    supabase.rpc('get_session_review', { p_session_id: id }),
    supabase.from('user_question_state').select('question_id, is_flagged, note').in('question_id', ids),
    session.mode === 'mock' && session.status === 'in_progress'
      ? supabase.from('user_responses').select('question_id, selected_answer').eq('session_id', id)
      : Promise.resolve({ data: [] }),
  ]);

  const byId = Object.fromEntries((qs || []).map((q) => [q.id, q]));
  const questions = ids.map((qid) => byId[qid]).filter(Boolean);

  return (
    <SessionRunner
      session={session}
      questions={questions}
      initialReview={review || []}
      initialStates={states || []}
      initialMockAnswers={responses || []}
    />
  );
}
