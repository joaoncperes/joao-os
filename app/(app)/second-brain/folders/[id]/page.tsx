import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FolderDetailClient } from './folder-detail-client';
import type { Folder, FolderColumn } from '@/lib/supabase/types';
import type { FolderRowData } from './table/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('folders')
    .select('title')
    .eq('id', id)
    .maybeSingle();
  const title = (data as { title?: string } | null)?.title;
  return { title: title ? `${title} — Second Brain — João OS` : 'Pasta — João OS' };
}

export default async function FolderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [folderRes, notesRes, columnsRes] = await Promise.all([
    supabase
      .from('folders')
      .select('id, user_id, para_category, parent_folder_id, title, description, status, due_date, completed_at, life_area, kind, default_view, table_view, position, archived_at, created_at, updated_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('notes')
      .select('id, title, content_md, source, tags, created_at, updated_at, properties')
      .eq('user_id', user.id)
      .eq('folder_id', id)
      .is('archived_at', null)
      .order('updated_at', { ascending: false }),
    supabase
      .from('folder_columns')
      .select('id, user_id, folder_id, name, type, options, position, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('folder_id', id)
      .order('position', { ascending: true }),
  ]);

  if (folderRes.error) throw new Error(`Could not load folder: ${folderRes.error.message}`);
  if (!folderRes.data) notFound();

  const folder = folderRes.data as Folder;
  const notes = (notesRes.data ?? []) as FolderRowData[];
  const columns = (columnsRes.data ?? []) as FolderColumn[];

  return (
    <FolderDetailClient
      folder={folder}
      notes={notes}
      columns={columns}
      initialView={folder.default_view}
    />
  );
}
