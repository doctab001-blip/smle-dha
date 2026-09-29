import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Markdown from '@/components/Markdown';
import StartSessionButton from '@/components/StartSession';

export const dynamic = 'force-dynamic';

export default async function NotePage({ params }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: note } = await supabase
    .from('high_yield_notes')
    .select('id, title, body_md, source_refs, updated_at, topics(title, subjects(name, slug))')
    .eq('slug', slug)
    .maybeSingle();
  if (!note) notFound();

  const subject = note.topics?.subjects;

  return (
    <main className="container narrow">
      <p className="small muted" style={{ marginBottom: 8 }}>
        <Link href="/notes">High-yield notes</Link> › {subject?.name} › {note.topics?.title}
      </p>
      <article className="card hy-note">
        <h1>{note.title}</h1>
        <div className="explanation"><Markdown>{note.body_md}</Markdown></div>
        {note.source_refs?.length > 0 && (
          <p className="small muted" style={{ marginTop: 16, marginBottom: 0 }}>
            Sources: {note.source_refs.join(' · ')}
          </p>
        )}
      </article>
      {subject && (
        <div className="card">
          <div className="actions">
            <span>Test yourself on {subject.name}</span>
            <span className="spacer" />
            <StartSessionButton args={{ p_mode: 'tutor', p_subjects: [subject.slug], p_count: 10 }} label="10 questions" className="btn sm" />
          </div>
        </div>
      )}
    </main>
  );
}
