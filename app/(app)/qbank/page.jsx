import { createClient } from '@/lib/supabase/server';
import { SUBJECTS } from '@/lib/constants';
import QBankForm from './QBankForm';

export const metadata = { title: 'Question bank' };
export const dynamic = 'force-dynamic';

export default async function QBankPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase.from('users').select('target_exam').maybeSingle();
  const counts = await Promise.all(
    SUBJECTS.map((s) =>
      supabase.from('questions').select('id', { count: 'exact', head: true }).eq('subject_category', s.slug)
    )
  );
  const subjects = SUBJECTS.map((s, i) => ({ ...s, count: counts[i].count || 0 }));
  const total = subjects.reduce((a, s) => a + s.count, 0);

  return (
    <main className="container narrow">
      <div className="page-head">
        <div>
          <h1>Question bank</h1>
          <p>Tutor mode: you see the answer and explanation straight after each question. {total} questions available.</p>
        </div>
      </div>
      <QBankForm subjects={subjects} defaultExam={profile?.target_exam || ''} />
    </main>
  );
}
