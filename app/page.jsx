import Link from 'next/link';
import SiteHeader, { SiteFooter } from '@/components/SiteHeader';
import { EXAMS } from '@/lib/exams';

export const dynamic = 'force-dynamic';

const FEATURES = [
  ['Clinical-vignette questions', 'Exam-style single-best-answer MCQs across all six subjects, with a full explanation of every option.'],
  ['Tutor and timed mock modes', 'Learn with instant feedback, or sit a strict, full-length timed block with answers hidden until you submit.'],
  ['Everything unlocked', 'Every subject, chapter and high-yield note is open from day one. Study in any order.'],
  ['Spaced-repetition revision', 'Questions you miss come back sooner, so your time goes to your weak areas.'],
  ['Performance analytics', 'Accuracy by subject, weak-topic re-tests, and your percentile against other candidates.'],
  ['Built for the Gulf', 'Sickle cell, G6PD, MERS-CoV, Hajj, Ramadan fasting and consanguinity are taught in regional context.'],
];

function ExamCard({ exam }) {
  return (
    <div className="exam-card">
      <div className="exam-card-top">
        <span className="pill brand">{exam.country}</span>
        <span className="exam-code">{exam.short}</span>
      </div>
      <h3>{exam.name}</h3>
      <p>{exam.tagline}</p>
      <ul className="ticks">
        <li>Full-length {exam.mockQuestions}-question timed mock</li>
        <li>Tutor mode with explanations and high-yield notes</li>
        <li>{exam.regional[0]}</li>
      </ul>
      <Link href={`/${exam.code}`} className="btn exam-card-btn">Prepare for the {exam.short} →</Link>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <SiteHeader />

      <section className="hero">
        <div className="hero-inner">
          <p className="eyebrow">For MBBS graduates seeking GP registration in the Gulf</p>
          <h1>Pass your Gulf medical licensing exam with focused, exam-style practice</h1>
          <p>
            A clean, distraction-free question bank with Prometric-style mocks, detailed explanations and high-yield
            notes — built around the clinical realities of Saudi Arabia and the UAE.
          </p>
        </div>
      </section>

      <main className="container">
        <section className="exam-select" aria-labelledby="choose-exam">
          <h2 id="choose-exam">Which exam are you preparing for?</h2>
          <p className="muted">Pick one to start. You can switch or study for both at any time from your dashboard.</p>
          <div className="exam-cards">
            <ExamCard exam={EXAMS.smle} />
            <ExamCard exam={EXAMS.dha} />
          </div>
        </section>

        <section style={{ marginTop: 48 }}>
          <h2>Everything you need, nothing you don&apos;t</h2>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {FEATURES.map(([title, body]) => (
              <div key={title} className="card feature">
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="muted" style={{ textAlign: 'center', marginTop: 32 }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
