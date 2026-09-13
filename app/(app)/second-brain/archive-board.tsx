'use client';

import { useMemo, useState } from 'react';
import { FolderTile } from './folder-tile';
import { CreateFolderInline } from './create-folder-inline';
import type { Folder } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

type ArchiveFilter = 'all' | 'completed';

interface Props {
  folders: Folder[];
  // Map não serializa de Server → Client Component; chega como objeto simples.
  noteCounts: Record<string, number>;
}

export function ArchiveBoard({ folders, noteCounts }: Props) {
  const [filter, setFilter] = useState<ArchiveFilter>('all');

  // Projetos concluídos = folders no archive com status='completed'.
  // Mais recentes primeiro (completed_at é um timestamp ISO → ordenação lexical).
  const completed = useMemo(
    () =>
      folders
        .filter((f) => f.status === 'completed')
        .sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
    [folders],
  );

  const shown = filter === 'completed' ? completed : folders;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterPill
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label="Todos"
          count={folders.length}
        />
        <FilterPill
          active={filter === 'completed'}
          onClick={() => setFilter('completed')}
          label="Projetos concluídos"
          count={completed.length}
        />
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col gap-3">
          <div className="bg-surface border-border text-text-3 rounded-2xl border px-5 py-10 text-center text-[13px]">
            {filter === 'completed'
              ? 'Nenhum projeto concluído ainda.'
              : 'Nada arquivado ainda.'}
          </div>
          {filter === 'all' ? <CreateFolderInline paraCategory="archive" /> : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {shown.map((f) => (
            <FolderTile key={f.id} folder={f} noteCount={noteCounts[f.id] ?? 0} />
          ))}
          {filter === 'all' ? <CreateFolderInline paraCategory="archive" /> : null}
        </div>
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-2.5 py-1 text-[12px] font-semibold ring-1 transition-colors',
        active
          ? 'bg-accent text-accent-foreground ring-accent'
          : 'bg-surface-2 text-text-2 ring-border hover:text-text',
      )}
    >
      {label}
      <span
        className={cn(
          'ml-1.5 tabular-nums',
          active ? 'text-accent-foreground/70' : 'text-text-3',
        )}
      >
        {count}
      </span>
    </button>
  );
}
