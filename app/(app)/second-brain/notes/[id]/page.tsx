import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Folder, Note, TipTapDoc } from '@/lib/supabase/types';
import { NoteEditorClient } from './note-editor-client';

export const metadata = { title: 'Nota — Second Brain — Pedro OS' };
export const dynamic = 'force-dynamic';

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [noteRes, foldersRes] = await Promise.all([
    supabase
      .from('notes')
      .select('id, user_id, life_area, area, folder_id, title, content_json, content_md, tags, source, archived_at, created_at, updated_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('folders')
      .select('id, user_id, para_category, parent_folder_id, title, description, status, due_date, life_area, kind, position, archived_at, created_at, updated_at')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('para_category', { ascending: true })
      .order('position', { ascending: true }),
  ]);

  if (noteRes.error) throw new Error(`Could not load note: ${noteRes.error.message}`);
  if (!noteRes.data) notFound();

  const note = noteRes.data as Note;
  const folders = (foldersRes.data ?? []) as Folder[];
  const initialContent: TipTapDoc = note.content_json ?? { type: 'doc', content: [] };

  return (
    <NoteEditorClient
      note={note}
      initialContent={initialContent}
      folders={folders}
    />
  );
}
