import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'High-yield notes' };
export const dynamic = 'force-dynamic';

export default async function NotesIndex({ searchParams }) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let notesQuery = supabase.from('high_yield_notes').select('id, slug, title, topic_id').order('title');
  if (q) notesQuery = notesQuery.textSearch('search', q, { type: 'websearch', config: 'english' });

  const [{ data: subjects }, { data: topics }, { data: notes }] = await Promise.all([
    supabase.from('subjects').select('id, slug, name').order('sort_order'),
    supabase.from('topics').select('id, subject_id, title, sort_order').order('sort_order'),
    notesQuery,
  ]);

  return (
    <main className="container narrow">
      <div className="page-head">
        <div>
          <h1>High-yield notes</h1>
          <p>Every chapter is open — read in any order.</p>
        </div>
        <form style={{ minWidth: 260 }}>
          <input type="text" name="q" defaultValue={q || ''} placeholder="Search notes…" aria-label="Search notes" />
        </form>
      </div>

      {q && (
        <p className="muted">
          {notes?.length || 0} result{notes?.length === 1 ? '' : 's'} for “{q}” · <Link href="/notes">clear</Link>
        </p>
      )}

      {(subjects || []).map((s) => {
        const subjectTopics = (topics || []).filter((t) => t.subject_id === s.id);
        const blocks = subjectTopics
          .map((t) => ({ topic: t, notes: (notes || []).filter((n) => n.topic_id === t.id) }))
          .filter((b) => b.notes.length);
        if (q && !blocks.length) return null;
        return (
          <div className="card" key={s.id}>
            <h2>{s.name}</h2>
            {blocks.length ? (
              blocks.map(({ topic, notes }) => (
                <div key={topic.id} style={{ marginBottom: 12 }}>
                  <div className="section-title" style={{ marginBottom: 6 }}>{topic.title}</div>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {notes.map((n) => (
                      <li key={n.id}><Link href={`/notes/${n.slug}`}>{n.title}</Link></li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="muted small" style={{ margin: 0 }}>Notes for this subject are being written.</p>
            )}
          </div>
        );
      })}
    </main>
  );
}
