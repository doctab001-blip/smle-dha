'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { subjectName, EXAM_LABELS } from '@/lib/constants';
import Markdown from '@/components/Markdown';
import LabValuesPanel from '@/components/LabValuesPanel';

const MODE_TITLE = { tutor: 'Tutor mode', revision: 'Revision set', mock: 'Timed mock exam' };

function fmtClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

// ---- local persistence (survives refresh / flaky connection) ----
const storeKey = (id) => `gmq:session:${id}`;
function readStore(id) {
  try { return JSON.parse(window.localStorage.getItem(storeKey(id)) || 'null'); } catch { return null; }
}
function writeStore(id, data) {
  try { window.localStorage.setItem(storeKey(id), JSON.stringify({ ...data, savedAt: Date.now() })); } catch { /* storage unavailable */ }
}
function clearStore(id) {
  try { window.localStorage.removeItem(storeKey(id)); } catch { /* ignore */ }
}

export default function SessionRunner({ session, questions, initialReview, initialStates, initialMockAnswers }) {
  const supabase = createClient();
  const router = useRouter();
  const isMock = session.mode === 'mock';

  const [status, setStatus] = useState(session.status);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState(() => Object.fromEntries(initialReview.map((r) => [r.question_id, r])));
  const [mockSel, setMockSel] = useState(() => Object.fromEntries(initialMockAnswers.map((r) => [r.question_id, r.selected_answer])));
  const [pending, setPending] = useState({}); // mock answers not yet confirmed by the server: {qid: {key, secs}}
  const [drafts, setDrafts] = useState({}); // tutor: option picked but not yet submitted {qid: key}
  const [flags, setFlags] = useState(() => Object.fromEntries(initialStates.map((s) => [s.question_id, s.is_flagged])));
  const [notes, setNotes] = useState(() => Object.fromEntries(initialStates.map((s) => [s.question_id, s.note || ''])));
  const [savedNotes, setSavedNotes] = useState(() => Object.fromEntries(initialStates.map((s) => [s.question_id, s.note || ''])));
  const [noteStatus, setNoteStatus] = useState('');
  const [noteCache, setNoteCache] = useState({});
  const [summary, setSummary] = useState(
    session.status === 'submitted'
      ? { correct: session.score_correct, total: session.score_total, pct: session.score_total ? Math.round((1000 * session.score_correct) / session.score_total) / 10 : 0 }
      : null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [labsOpen, setLabsOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [remaining, setRemaining] = useState(null); // set on the client only (avoids hydration mismatch)
  const barRef = useRef(null);
  const qStart = useRef(Date.now());
  const submitting = useRef(false);

  const q = questions[idx];
  const submitted = status === 'submitted';
  const result = q ? results[q.id] : null;
  const showAnswers = isMock ? submitted : !!result;
  const sel = q ? drafts[q.id] ?? null : null;

  // ---- restore local state after refresh ----
  useEffect(() => {
    const saved = readStore(session.id);
    if (saved && session.status === 'in_progress') {
      if (Number.isInteger(saved.idx)) setIdx(Math.min(Math.max(saved.idx, 0), questions.length - 1));
      if (saved.drafts) setDrafts(saved.drafts);
      if (saved.noteDrafts) setNotes((n) => ({ ...n, ...saved.noteDrafts }));
      if (isMock && saved.pending && Object.keys(saved.pending).length) {
        setPending(saved.pending);
        setMockSel((m) => ({ ...m, ...Object.fromEntries(Object.entries(saved.pending).map(([k, v]) => [k, v.key])) }));
      }
    } else if (saved && session.status !== 'in_progress') {
      clearStore(session.id);
    }
    if (window.innerWidth < 1000) setNavOpen(false);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- save local state on every change ----
  useEffect(() => {
    if (!hydrated || submitted) return;
    const noteDrafts = Object.fromEntries(Object.entries(notes).filter(([k, v]) => v !== (savedNotes[k] || '')));
    writeStore(session.id, { idx, drafts, pending, noteDrafts });
  }, [hydrated, submitted, session.id, idx, drafts, pending, notes, savedNotes]);

  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--exam-bar-h', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { qStart.current = Date.now(); }, [idx]);
  const elapsed = () => Math.round((Date.now() - qStart.current) / 1000);

  // ---- submit the whole session ----
  const submitSession = useCallback(async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setConfirmOpen(false);
    setError('');
    // push any answers still waiting to sync before grading
    for (const [qid, p] of Object.entries(pending)) {
      await supabase.rpc('answer_question', { p_session_id: session.id, p_question_id: qid, p_selected: p.key, p_time_seconds: p.secs });
    }
    const { data, error } = await supabase.rpc('submit_session', { p_session_id: session.id });
    if (error) {
      setError(error.message);
      setBusy(false);
      submitting.current = false;
      return;
    }
    setSummary(data);
    setStatus('submitted');
    setPending({});
    clearStore(session.id);
    if (isMock) {
      const { data: rev } = await supabase.rpc('get_session_review', { p_session_id: session.id });
      setResults(Object.fromEntries((rev || []).map((r) => [r.question_id, r])));
      setIdx(0);
    }
    setBusy(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    router.refresh();
  }, [supabase, session.id, isMock, router, pending]);

  // ---- mock timer (server expiry is authoritative, so refresh can't reset it) ----
  useEffect(() => {
    if (!isMock || submitted || !session.expires_at) return;
    const tick = () => {
      const left = (new Date(session.expires_at) - Date.now()) / 1000;
      setRemaining(left);
      if (left <= 0) submitSession();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [isMock, submitted, session.expires_at, submitSession]);

  // ---- retry unsynced mock answers (offline / flaky network) ----
  const flushPending = useCallback(async () => {
    const entries = Object.entries(pending);
    if (!entries.length || submitted) return;
    for (const [qid, p] of entries) {
      const { error } = await supabase.rpc('answer_question', {
        p_session_id: session.id, p_question_id: qid, p_selected: p.key, p_time_seconds: p.secs,
      });
      if (!error) setPending((cur) => { const n = { ...cur }; if (n[qid]?.key === p.key) delete n[qid]; return n; });
      else if (/time is up/i.test(error.message)) return submitSession();
    }
  }, [pending, submitted, supabase, session.id, submitSession]);

  useEffect(() => {
    if (!hydrated || !Object.keys(pending).length) return;
    const t = setInterval(flushPending, 15000);
    window.addEventListener('online', flushPending);
    return () => { clearInterval(t); window.removeEventListener('online', flushPending); };
  }, [hydrated, pending, flushPending]);

  // flush answers restored from a previous page load
  useEffect(() => {
    if (hydrated) flushPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // ---- load the linked high-yield note once the answer is visible ----
  const noteId = showAnswers ? (result?.note_id || q?.note_id) : null;
  useEffect(() => {
    if (!noteId || noteCache[noteId]) return;
    let cancelled = false;
    supabase.from('high_yield_notes').select('id, slug, title, body_md').eq('id', noteId).maybeSingle()
      .then(({ data }) => { if (!cancelled && data) setNoteCache((c) => ({ ...c, [noteId]: data })); });
    return () => { cancelled = true; };
  }, [noteId, noteCache, supabase]);

  // ---- answering ----
  async function submitTutorAnswer() {
    if (!sel || busy || result) return;
    setBusy(true);
    setError('');
    const { data, error } = await supabase.rpc('answer_question', {
      p_session_id: session.id, p_question_id: q.id, p_selected: sel, p_time_seconds: elapsed(),
    });
    setBusy(false);
    if (error) return setError(error.message);
    setResults((r) => ({ ...r, [q.id]: { ...data, question_id: q.id } }));
    setDrafts((d) => { const n = { ...d }; delete n[q.id]; return n; });
  }

  async function chooseMock(key) {
    if (submitted) return;
    const secs = elapsed();
    qStart.current = Date.now();
    setMockSel((m) => ({ ...m, [q.id]: key }));
    setPending((p) => ({ ...p, [q.id]: { key, secs: (p[q.id]?.secs || 0) + secs } }));
    const { error } = await supabase.rpc('answer_question', {
      p_session_id: session.id, p_question_id: q.id, p_selected: key, p_time_seconds: secs,
    });
    if (!error) {
      setPending((p) => { const n = { ...p }; if (n[q.id]?.key === key) delete n[q.id]; return n; });
    } else if (/time is up/i.test(error.message)) {
      submitSession();
    } else {
      setError('Answer saved on this device — it will sync automatically when the connection returns.');
    }
  }

  function choose(key) {
    if (isMock) return chooseMock(key);
    if (!result && !submitted) setDrafts((d) => ({ ...d, [q.id]: key }));
  }

  // ---- flags & notes ----
  async function toggleFlag() {
    const next = !flags[q.id];
    setFlags((f) => ({ ...f, [q.id]: next }));
    const { error } = await supabase.rpc('set_flag', { p_question_id: q.id, p_flagged: next });
    if (error) { setFlags((f) => ({ ...f, [q.id]: !next })); setError(error.message); }
  }

  // autosave notes 1.2 s after typing stops
  const currentNote = q ? notes[q.id] || '' : '';
  const currentSaved = q ? savedNotes[q.id] || '' : '';
  useEffect(() => {
    if (!q || currentNote === currentSaved) return;
    setNoteStatus('Unsaved');
    const qid = q.id;
    const t = setTimeout(async () => {
      setNoteStatus('Saving…');
      const { error } = await supabase.rpc('save_note', { p_question_id: qid, p_note: currentNote });
      if (error) return setNoteStatus('Not saved — kept on this device');
      setSavedNotes((s) => ({ ...s, [qid]: currentNote }));
      setNoteStatus('Saved');
    }, 1200);
    return () => clearTimeout(t);
  }, [q, currentNote, currentSaved, supabase]);
  useEffect(() => { setNoteStatus(''); }, [idx]);

  const go = (i) => { setError(''); setIdx(Math.max(0, Math.min(questions.length - 1, i))); };
  const isLast = idx === questions.length - 1;
  const answeredCount = isMock ? Object.values(mockSel).filter(Boolean).length : Object.values(results).length;
  const allAnswered = answeredCount >= questions.length;

  // ---- keyboard shortcuts ----
  useEffect(() => {
    function onKey(e) {
      if (labsOpen || confirmOpen) return;
      const tag = e.target?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!q) return;
      const k = e.key.toUpperCase();
      const keys = (q.options || []).map((o) => o.key);
      if (keys.includes(k) && !(isMock && submitted)) { e.preventDefault(); choose(k); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (!isMock && !result && sel && !submitted) submitTutorAnswer();
        else if (!isLast) go(idx + 1);
      } else if (e.key === 'ArrowRight') go(idx + 1);
      else if (e.key === 'ArrowLeft') go(idx - 1);
      else if (k === 'F') { e.preventDefault(); toggleFlag(); }
      else if (k === 'L') { e.preventDefault(); setLabsOpen(true); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const peer = result?.peer_stats;
  const peerPct = (key) => (peer?.attempts ? Math.round((100 * (peer.by_option?.[key] || 0)) / peer.attempts) : null);

  const cellClass = useCallback((qq, i) => {
    const r = results[qq.id];
    let c = 'navcell';
    if (isMock && !submitted) { if (mockSel[qq.id]) c += ' answered'; }
    else if (r) c += r.is_correct ? ' good' : ' bad';
    if (flags[qq.id]) c += ' flagged';
    if (i === idx) c += ' current';
    return c;
  }, [results, isMock, submitted, mockSel, flags, idx]);

  const unanswered = useMemo(() => questions.filter((qq) => !mockSel[qq.id]).length, [questions, mockSel]);
  const unsynced = Object.keys(pending).length;

  if (!questions.length) {
    return (
      <main className="container narrow">
        <div className="card"><p>This session has no questions available.</p><Link href="/qbank">Back to the question bank</Link></div>
      </main>
    );
  }

  const selected = isMock ? (submitted ? result?.selected_answer : mockSel[q.id]) : (result ? result.selected_answer : sel);
  const correctKey = showAnswers ? result?.correct_answer : null;
  const note = noteId ? noteCache[noteId] : null;
  const wrongOptions = showAnswers && result ? (q.options || []).filter((o) => o.key !== correctKey) : [];

  return (
    <main className="container wide">
      {summary && (
        <div className="card" style={{ marginBottom: 12, borderTop: `4px solid ${summary.pct >= 60 ? 'var(--good)' : 'var(--bad)'}` }}>
          <div className="actions">
            <div>
              <div className="section-title" style={{ marginBottom: 2 }}>{isMock ? 'Block submitted' : 'Session complete'}</div>
              <div style={{ fontSize: 26, fontWeight: 700 }}>
                {summary.correct} / {summary.total} <span className="muted" style={{ fontSize: 18 }}>({summary.pct ?? 0}%)</span>
              </div>
              <div className="muted small">Questions you got wrong have been added to your revision set.</div>
            </div>
            <span className="spacer" />
            <Link href="/dashboard" className="btn secondary">Dashboard</Link>
            <Link href="/revision" className="btn">Revision</Link>
          </div>
        </div>
      )}

      {/* ---- exam toolbar ---- */}
      <div className="exam-bar" ref={barRef}>
        <div className="exam-bar-row">
          <strong>{MODE_TITLE[session.mode]}{session.mock_format ? ` · ${session.mock_format.replace('_', ' ').toUpperCase()}` : ''}</strong>
          <span className="muted small">Question {idx + 1} of {questions.length} · {answeredCount} answered</span>
          {unsynced > 0 && <span className="pill warn">{unsynced} answer{unsynced > 1 ? 's' : ''} waiting to sync</span>}
          <span className="spacer" />
          {isMock && !submitted && remaining != null && (
            <span className={`timer ${remaining < 600 ? 'low' : ''}`} title="Time remaining">{fmtClock(remaining)}</span>
          )}
          <button className="btn sm ghost" onClick={() => setNavOpen((v) => !v)}>{navOpen ? 'Hide' : 'Show'} navigator</button>
          {isMock && !submitted && (
            <button className="btn sm danger" onClick={() => setConfirmOpen(true)} disabled={busy}>{busy ? 'Submitting…' : 'Submit block'}</button>
          )}
          {!isMock && !submitted && Object.keys(results).length > 0 && (
            <button className="btn sm ghost" onClick={submitSession} disabled={busy}>{allAnswered ? 'Finish session' : 'End session'}</button>
          )}
        </div>
        {navOpen && (
          <div className="exam-nav">
            <div className="navgrid">
              {questions.map((qq, i) => (
                <button key={qq.id} className={cellClass(qq, i)} onClick={() => go(i)} aria-label={`Question ${i + 1}`}>{i + 1}</button>
              ))}
            </div>
            <div className="legend">
              {isMock && !submitted ? <span><i style={{ background: '#dbe3ea' }} />Answered</span> : (
                <>
                  <span><i style={{ background: 'var(--good-soft)' }} />Correct</span>
                  <span><i style={{ background: 'var(--bad-soft)' }} />Wrong</span>
                </>
              )}
              <span><i style={{ background: 'var(--flag)', borderRadius: '50%', width: 7, height: 7 }} />Flagged</span>
              <span className="muted kbd-hint">Keys: A–E choose · Enter submit/next · ← → move · F flag · L lab values</span>
            </div>
          </div>
        )}
      </div>

      {/* ---- Prometric split: vignette | answers ---- */}
      <div className="split">
        <section className="split-left">
          <div className="card">
            <div className="qhead">
              <div className="qmeta">
                <strong>Question {idx + 1}</strong>
                <span className="pill">{subjectName(q.subject_category)}</span>
                {(q.exam_targets || []).map((e) => <span key={e} className="pill brand">{EXAM_LABELS[e]}</span>)}
              </div>
              <div className="actions">
                <button className="btn sm ghost" onClick={() => setLabsOpen(true)}>Lab values</button>
                <button className={`btn sm ghost flag-btn ${flags[q.id] ? 'on' : ''}`} onClick={toggleFlag}>
                  {flags[q.id] ? '⚑ Flagged' : '⚐ Flag for review'}
                </button>
              </div>
            </div>

            <div className="vignette">
              {q.text.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}
            </div>

            {Array.isArray(q.lab_values) && q.lab_values.length > 0 && (
              <table className="labs">
                <thead><tr><th>Test</th><th>Result</th><th>Reference</th></tr></thead>
                <tbody>
                  {q.lab_values.map((l, i) => (
                    <tr key={i}><td>{l.test}</td><td><strong>{l.value}</strong> {l.unit}</td><td className="muted">{l.ref}</td></tr>
                  ))}
                </tbody>
              </table>
            )}

            {(q.media || []).map((m, i) =>
              m.type === 'image' ? (
                <figure key={i} style={{ margin: '0 0 16px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={m.caption || 'Clinical image'} style={{ maxWidth: '100%', borderRadius: 8 }} />
                  {m.caption && <figcaption className="small muted">{m.caption}</figcaption>}
                </figure>
              ) : null
            )}

            {q.lead_in && <p className="leadin" style={{ marginBottom: 0 }}>{q.lead_in}</p>}
          </div>

          <div className="card notes-card">
            <div className="actions" style={{ marginBottom: 8 }}>
              <div className="section-title" style={{ margin: 0 }}>My notes</div>
              <span className="spacer" />
              {noteStatus && <span className="small muted">{noteStatus}</span>}
            </div>
            <textarea
              value={currentNote}
              onChange={(e) => setNotes((n) => ({ ...n, [q.id]: e.target.value }))}
              placeholder="Write a note to yourself about this question — it saves automatically…"
              maxLength={5000}
            />
          </div>
        </section>

        <section className="split-right">
          <div className="card">
            <div className="options" role="radiogroup" style={{ marginTop: 0 }}>
              {(q.options || []).map((o) => {
                let cls = 'option';
                if (showAnswers) {
                  if (o.key === correctKey) cls += ' correct';
                  else if (o.key === selected) cls += ' incorrect';
                } else if (o.key === selected) cls += ' selected';
                const pp = !isMock && showAnswers ? peerPct(o.key) : null;
                return (
                  <button
                    key={o.key}
                    className={cls}
                    role="radio"
                    aria-checked={o.key === selected}
                    disabled={showAnswers || (submitted && !isMock)}
                    onClick={() => choose(o.key)}
                  >
                    <span className="key">{o.key}</span>
                    <span className="otext">{o.text}</span>
                    {pp != null && <span className="ostat">{pp}%</span>}
                  </button>
                );
              })}
            </div>

            {error && <div className="alert error">{error}</div>}

            {showAnswers && result && (
              <div className={`verdict ${result.is_correct ? 'good' : 'bad'}`}>
                <span>
                  {result.is_correct
                    ? '✓ Correct'
                    : result.selected_answer
                      ? `✗ Incorrect — the answer is ${result.correct_answer}`
                      : `Not answered — the answer is ${result.correct_answer}`}
                </span>
                {peer?.attempts > 0 && (
                  <span className="peer">{peer.pct_correct}% of {peer.attempts} attempt{peer.attempts === 1 ? '' : 's'} correct</span>
                )}
              </div>
            )}

            <div className="actions">
              <button className="btn ghost" disabled={idx === 0} onClick={() => go(idx - 1)}>← Previous</button>
              <span className="spacer" />
              {!isMock && !result && !submitted && (
                <button className="btn" disabled={!sel || busy} onClick={submitTutorAnswer}>{busy ? 'Checking…' : 'Submit answer'}</button>
              )}
              {(isMock || result || submitted) && !isLast && (
                <button className={`btn ${isMock && !submitted ? 'secondary' : ''}`} onClick={() => go(idx + 1)}>Next →</button>
              )}
              {!isMock && !submitted && result && isLast && (
                <button className="btn" onClick={submitSession} disabled={busy}>Finish session</button>
              )}
            </div>
          </div>

          {showAnswers && result?.explanation && (
            <div className="card">
              <div className="section-title">Explanation — why {correctKey} is correct</div>
              <div className="explanation"><Markdown>{result.explanation}</Markdown></div>

              {wrongOptions.length > 0 && (
                <>
                  <div className="section-title" style={{ marginTop: 16 }}>Why the other options are wrong</div>
                  <div className="accordion">
                    {wrongOptions.map((o) => (
                      <details key={o.key} open={o.key === selected}>
                        <summary>
                          <span className={`key-dot ${o.key === selected ? 'bad' : ''}`}>{o.key}</span>
                          <span>{o.text}</span>
                        </summary>
                        <div className="accordion-body">
                          {result.option_explanations?.[o.key] || <span className="muted">No explanation provided for this option.</span>}
                        </div>
                      </details>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {showAnswers && note && (
            <div className="card hy-note">
              <div className="section-title">High-yield note · {note.title}</div>
              <div className="explanation"><Markdown>{note.body_md}</Markdown></div>
              <Link href={`/notes/${note.slug}`} className="small">Open full note →</Link>
            </div>
          )}

          {!showAnswers && (
            <p className="small muted" style={{ textAlign: 'center', marginTop: 12 }}>
              {isMock ? 'Answers and explanations appear after you submit the block.' : 'Choose an option and press Submit answer to see the explanation.'}
            </p>
          )}
        </section>
      </div>

      {labsOpen && <LabValuesPanel onClose={() => setLabsOpen(false)} />}

      {confirmOpen && (
        <div className="modal-back" onClick={() => setConfirmOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Submit this block?</h2>
            <p>
              {unanswered > 0
                ? `You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. Unanswered questions are marked incorrect.`
                : 'You have answered every question.'}{' '}
              You can&apos;t change answers after submitting.
            </p>
            <div className="actions">
              <span className="spacer" />
              <button className="btn ghost" onClick={() => setConfirmOpen(false)}>Keep working</button>
              <button className="btn danger" onClick={submitSession}>Submit block</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
