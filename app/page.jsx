import Link from 'next/link';
import { SITE_NAME } from '@/lib/constants';

const FEATURES = [
  {
    title: 'Clinical-vignette question bank',
    body: 'Exam-style MCQs across Medicine, Surgery, Pediatrics, OBGYN, Preventive Medicine & Ethics and Psychiatry — with regional topics like sickle cell disease, MERS-CoV, consanguinity and Ramadan fasting.',
  },
  {
    title: 'Tutor mode with instant feedback',
    body: 'See whether you were right straight away, read a full explanation of every option, and compare yourself with how other candidates answered.',
  },
  {
    title: 'Timed SMLE & DHA mocks',
    body: 'Full-length timed blocks in the SMLE (200 questions) and DHA (150 questions) formats. Answers stay hidden until you submit — just like the real exam.',
  },
  {
    title: 'High-yield notes, always open',
    body: 'Every chapter and note is unlocked from day one. Each question links to the note that covers it, so you can revise the topic straight away.',
  },
  {
    title: 'Spaced repetition revision',
    body: 'Questions you get wrong come back sooner, and ones you master fade out — so your revision time goes where it counts.',
  },
  {
    title: 'Performance analytics',
    body: 'Overall accuracy, your percentile against other users, and a subject radar showing your strong and weak areas.',
  },
];

export default function Landing() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">{SITE_NAME}</Link>
          <div className="spacer" />
          <Link href="/login" className="btn sm secondary" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.5)' }}>
            Sign in
          </Link>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <h1>Pass the SMLE and DHA licensing exams with focused, exam-style practice</h1>
          <p>
            A clean, distraction-free question bank for MBBS graduates preparing for Saudi and UAE general
            practitioner registration.
          </p>
          <div className="actions" style={{ marginTop: 28 }}>
            <Link href="/login?mode=signup" className="btn">Create a free account</Link>
            <Link href="/login" className="btn secondary">I already have an account</Link>
          </div>
        </div>
      </section>

      <main className="container">
        <div className="grid grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))' }}>
          {FEATURES.map((f) => (
            <div key={f.title} className="card feature">
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="footer">
        {SITE_NAME} is an independent study resource and is not affiliated with the Saudi Commission for Health
        Specialties (SCFHS), the Dubai Health Authority (DHA), DOH or MOHAP.
      </footer>
    </>
  );
}
