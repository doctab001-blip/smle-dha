import ExamLanding from '@/components/ExamLanding';
import { EXAMS } from '@/lib/exams';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: `${EXAMS.dha.short} question bank`,
  description: `${EXAMS.dha.name} preparation: exam-style MCQs, a ${EXAMS.dha.mockQuestions}-question timed mock, explanations and high-yield notes.`,
};

export default function DHAPage() {
  return <ExamLanding exam={EXAMS.dha} />;
}
