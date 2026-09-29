import Link from 'next/link';
import SiteHeader, { SiteFooter } from '@/components/SiteHeader';
import { SUBJECTS } from '@/lib/constants';

// Shared landing page for /smle and /dha.
export default function ExamLanding({ exam }) {
  const signup = `/login?exam=${exam.code}&mode=signup`;
  const start = `/login?exam=${exam.code}`;
  return (
    <>
      <SiteHeader />

      <section className="hero">
        <div className="hero-inner">
          <p className="eyebrow">{exam.country} · {exam.short} preparation</p>
          <h1>{exam.name} question bank</h1>
          <p>{exam.tagline}</p>
          <div className="actions" style={{ marginTop: 28 }}>
            <Link href={signup} className="btn">Create free account</Link>
            <Link href={start} className="btn secondary">Start practising now</Link>
          </div>
        </div>
      </section>

      <main className="container">
        <div className="grid grid-2">
          <div className="card">
            <h2>Train in an {exam.short}-style format</h2>
            <ul className="ticks">
              <li><strong>{exam.mockQuestions}-question timed mock</strong> with a strict countdown; answers stay hidden until you submit.</li>
              <li><strong>Prometric-style screen:</strong> vignette on the left, options on the right, lab-values sheet and flag-for-review.</li>
              <li><strong>Tutor mode</strong> for learning: instant green/red feedback, why every wrong option is wrong, and a high-yield note.</li>
              <li><strong>Progress is saved</strong> even if your browser refreshes or the connection drops mid-block.</li>
            </ul>
          </div>
          <div className="card">
            <h2>Regional topics you need to know</h2>
            <ul className="ticks">
              {exam.regional.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h2>All six subjects, unlocked from day one</h2>
          <p className="muted">No drip-feeding and no locked chapters. Every subject, chapter and high-yield note is open in any order.</p>
          <div className="chips" style={{ marginTop: 10 }}>
            {SUBJECTS.map((s) => <span key={s.slug} className="chip on" style={{ cursor: 'default' }}>{s.name}</span>)}
          </div>
        </div>

        <div className="cta-band">
          <div>
            <h2 style={{ margin: 0 }}>Ready to start your {exam.short} preparation?</h2>
            <p style={{ margin: '6px 0 0' }}>Free account · no card needed · study on any device.</p>
          </div>
          <div className="actions">
            <Link href={signup} className="btn">Create free account</Link>
            <Link href={start} className="btn secondary">I have an account</Link>
          </div>
        </div>

        <p className="muted small" style={{ textAlign: 'center' }}>
          Preparing for both? You can switch between SMLE and DHA at any time from your dashboard.
          {' '}<Link href={exam.code === 'smle' ? '/dha' : '/smle'}>See the {exam.code === 'smle' ? 'DHA' : 'SMLE'} page →</Link>
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
