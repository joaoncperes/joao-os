import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InboxClient, type InboxNote } from './inbox-client';
import type { Folder } from '@/lib/supabase/types';

export const metadata = { title: 'Inbox — Second Brain — Pedro OS' };
export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [notesRes, foldersRes] = await Promise.all([
    supabase
      .from('notes')
      .select('id, title, content_md, source, tags, created_at, updated_at')
      .eq('user_id', user.id)
      .is('folder_id', null)
      .is('archived_at', null)
      .order('updated_at', { ascending: false }),
    supabase
      .from('folders')
      .select('id, user_id, para_category, parent_folder_id, title, description, status, due_date, life_area, kind, position, archived_at, created_at, updated_at')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('para_category', { ascending: true })
      .order('position', { ascending: true }),
  ]);

  const notes = (notesRes.data ?? []) as InboxNote[];
  const folders = (foldersRes.data ?? []) as Folder[];

  return (
    <InboxClient
      initialNotes={notes}
      folders={folders}
      loadError={notesRes.error?.message ?? null}
    />
  );
}
