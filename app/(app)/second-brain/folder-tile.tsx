import Link from 'next/link';
import { ArrowRight, FolderClosed, Library } from 'lucide-react';
import {
  LIFE_AREA_ICON,
} from '@/lib/second-brain/display';
import type { Folder } from '@/lib/supabase/types';
import { dateInTz } from '@/lib/date';
import { cn } from '@/lib/utils';

interface Props {
  folder: Folder;
  noteCount: number;
  href?: string;
}

export function FolderTile({ folder, noteCount, href }: Props) {
  const linkHref = href ?? `/second-brain/folders/${folder.id}`;
  const Icon = folder.kind === 'books'
    ? Library
    : folder.life_area
      ? LIFE_AREA_ICON[folder.life_area]
      : FolderClosed;

  return (
    <Link
      href={linkHref}
      className="group bg-surface border-border hover:border-accent block rounded-2xl border p-4 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl',
            folder.kind === 'books'
              ? 'bg-accent-soft text-accent'
              : 'bg-surface-2 text-text-2',
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <ArrowRight className="text-text-3 group-hover:text-text mt-2 h-4 w-4 transition-colors" />
      </div>
      <div className="mt-3 flex flex-col leading-tight">
        <span className="text-text text-[15px] font-semibold tracking-[-0.005em]">
          {folder.title}
        </span>
        {folder.description ? (
          <span className="text-text-3 mt-1 line-clamp-2 text-[12.5px] leading-relaxed">
            {folder.description}
          </span>
        ) : null}
      </div>
      <div className="text-text-3 mt-3 flex items-center gap-3 text-[11.5px]">
        <span className="flex items-baseline gap-1">
          <span className="text-text text-[13px] font-semibold tabular-nums">
            {noteCount}
          </span>
          <span>nota{noteCount === 1 ? '' : 's'}</span>
        </span>
        {folder.due_date ? (
          <span className="text-text-2">até {formatShortDate(folder.due_date)}</span>
        ) : null}
        {folder.status === 'on_hold' ? (
          <span className="text-amber-500">em pausa</span>
        ) : null}
        {folder.status === 'completed' ? (
          <span className="text-emerald-500">
            {folder.completed_at
              ? `concluído em ${formatShortDate(dateInTz(folder.completed_at))}`
              : 'concluído'}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

function formatShortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${d} ${months[m - 1]}`;
}
