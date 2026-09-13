import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { FolderTile } from './folder-tile';
import { CreateFolderInline } from './create-folder-inline';
import { ArchiveBoard } from './archive-board';
import {
  PARA_CATEGORY_DESCRIPTION,
  PARA_CATEGORY_ICON,
  PARA_CATEGORY_LABEL,
} from '@/lib/second-brain/display';
import type { Folder, ParaCategory } from '@/lib/supabase/types';

interface Props {
  paraCategory: ParaCategory;
}

export async function CategoryShell({ paraCategory }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [foldersRes, noteCountsRes] = await Promise.all([
    supabase
      .from('folders')
      .select('id, user_id, para_category, parent_folder_id, title, description, status, due_date, completed_at, life_area, kind, position, archived_at, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('para_category', paraCategory)
      .is('archived_at', null)
      .order('position', { ascending: true }),
    supabase
      .from('notes')
      .select('folder_id')
      .eq('user_id', user.id)
      .is('archived_at', null),
  ]);

  const folders = (foldersRes.data ?? []) as Folder[];
  const noteCounts = new Map<string, number>();
  for (const row of (noteCountsRes.data ?? []) as { folder_id: string | null }[]) {
    if (!row.folder_id) continue;
    noteCounts.set(row.folder_id, (noteCounts.get(row.folder_id) ?? 0) + 1);
  }

  const Icon = PARA_CATEGORY_ICON[paraCategory];

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <Link
          href="/second-brain"
          className="text-text-3 hover:text-text flex w-fit items-center gap-1 text-[12px] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Second Brain
        </Link>
        <div className="flex items-center gap-3">
          <span className="bg-accent-soft text-accent flex h-11 w-11 items-center justify-center rounded-xl">
            <Icon className="h-5 w-5" />
          </span>
          <div className="flex flex-col leading-tight">
            <h1 className="text-text text-[24px] font-semibold tracking-[-0.015em]">
              {PARA_CATEGORY_LABEL[paraCategory]}
            </h1>
            <p className="text-text-3 mt-0.5 text-[12.5px]">
              {PARA_CATEGORY_DESCRIPTION[paraCategory]}
            </p>
          </div>
        </div>
      </header>

      <section>
        {paraCategory === 'archive' ? (
          <ArchiveBoard
            folders={folders}
            noteCounts={Object.fromEntries(noteCounts)}
          />
        ) : folders.length === 0 ? (
          <div className="flex flex-col gap-3">
            <div className="bg-surface border-border text-text-3 rounded-2xl border px-5 py-10 text-center text-[13px]">
              Nenhuma pasta ainda nesta categoria.
            </div>
            <CreateFolderInline paraCategory={paraCategory} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {folders.map((f) => (
              <FolderTile
                key={f.id}
                folder={f}
                noteCount={noteCounts.get(f.id) ?? 0}
              />
            ))}
            <CreateFolderInline paraCategory={paraCategory} />
          </div>
        )}
      </section>
    </div>
  );
}
