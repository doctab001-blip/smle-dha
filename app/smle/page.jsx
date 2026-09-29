import ExamLanding from '@/components/ExamLanding';
import { EXAMS } from '@/lib/exams';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: `${EXAMS.smle.short} question bank`,
  description: `${EXAMS.smle.name} preparation: exam-style MCQs, a ${EXAMS.smle.mockQuestions}-question timed mock, explanations and high-yield notes.`,
};

export default function SMLEPage() {
  return <ExamLanding exam={EXAMS.smle} />;
}
