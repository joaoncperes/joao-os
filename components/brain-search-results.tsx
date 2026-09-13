import Link from 'next/link';
import { Archive, BookOpen, FileText, Inbox as InboxIcon } from 'lucide-react';
import type { BrainSearchHit, ParaCategory } from '@/lib/supabase/types';
import { PARA_CATEGORY_LABEL } from '@/lib/second-brain/display';
import { TagChip } from '@/components/tag-chip';
import { cn } from '@/lib/utils';

function hitHref(hit: BrainSearchHit): string {
  return hit.kind === 'book'
    ? `/books/${hit.id}`
    : `/second-brain/notes/${hit.id}`;
}

function locationLabel(hit: BrainSearchHit): string {
  if (hit.kind === 'book') return 'Book';
  if (hit.para_category === 'inbox' || hit.para_category == null) return 'Inbox';
  return hit.folder_title ?? PARA_CATEGORY_LABEL[hit.para_category as ParaCategory];
}

function hitIcon(hit: BrainSearchHit) {
  if (hit.kind === 'book') return BookOpen;
  if (hit.archived) return Archive;
  if (hit.para_category === 'inbox' || hit.para_category == null) return InboxIcon;
  return FileText;
}

interface Props {
  hits: BrainSearchHit[];
  /** Fired when a result is clicked (e.g. to close the command palette). */
  onNavigate?: () => void;
  /** Tighter rows, no tag chips — used in the command palette. */
  compact?: boolean;
}

/**
 * Presentational result list shared by the dedicated search page and the
 * ⌘K command palette. Snippets may contain <mark> tags from ts_headline.
 */
export function BrainSearchResults({ hits, onNavigate, compact }: Props) {
  return (
    <ul className="flex flex-col">
      {hits.map((hit) => {
        const Icon = hitIcon(hit);
        return (
          <li key={`${hit.kind}:${hit.id}`} className="border-border border-b last:border-b-0">
            <Link
              href={hitHref(hit)}
              onClick={onNavigate}
              className={cn(
                'hover:bg-surface-2 block transition-colors',
                compact ? 'px-4 py-2.5' : 'px-4 pt-3 pb-2.5',
              )}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="text-text-3 h-3.5 w-3.5 shrink-0" />
                <span className="text-text-3 text-[10.5px] font-medium uppercase tracking-[0.04em]">
                  {locationLabel(hit)}
                </span>
                {hit.archived ? (
                  <span className="bg-surface-2 text-text-3 rounded px-1 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.04em]">
                    Arquivado
                  </span>
                ) : null}
              </div>
              <div className="text-text mt-1 text-[13.5px] font-semibold leading-tight">
                {hit.title}
              </div>
              {hit.snippet ? (
                <div
                  className="text-text-2 mt-1 line-clamp-2 text-[12px] leading-relaxed [&_mark]:bg-accent/30 [&_mark]:text-text [&_mark]:rounded-sm [&_mark]:px-0.5"
                  dangerouslySetInnerHTML={{ __html: hit.snippet }}
                />
              ) : null}
            </Link>
            {!compact && hit.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1 px-4 pb-3">
                {hit.tags.map((t) => (
                  <TagChip key={t} tag={t} size="sm" plain />
                ))}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
