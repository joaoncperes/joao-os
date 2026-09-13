'use client';

import Link from 'next/link';
import { FileText, Pencil } from 'lucide-react';
import { PriorityChip } from '@/components/priority-chip';
import { CategoryChip } from '@/components/category-chip';
import { PendingNotesChip } from '@/components/pending-notes-chip';
import { GradeChip } from '@/components/grade-chip';
import { formatBookFinishedDate, formatReadingDate } from '@/lib/books-display';
import type { CategoryColorMap } from '@/lib/book-categories';
import type { Book } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

interface Props {
  book: Book;
  onEdit: (book: Book) => void;
  categoryColors?: CategoryColorMap;
}

export function BookListRow({ book, onEdit, categoryColors }: Props) {
  const dateLabel = formatBookFinishedDate(book) || formatReadingDate(book.started_at);
  const dateContext = book.finished_at ? 'Read on' : book.finished_year ? 'Read in' : book.started_at ? 'Started' : null;
  return (
    <li className="bg-surface border-border group hover:bg-surface-2/40 relative rounded-xl border transition-colors">
      <Link
        href={`/books/${book.id}`}
        className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4 sm:px-5 sm:py-4"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start gap-2">
            <FileText className="text-text-3 mt-0.5 hidden h-4 w-4 shrink-0 sm:block" />
            <div className="min-w-0">
              <div className="text-text text-[14.5px] font-semibold leading-snug tracking-[-0.005em]">
                {book.title}
              </div>
              {book.author ? (
                <div className="text-text-3 mt-0.5 text-[12px]">{book.author}</div>
              ) : null}
            </div>
          </div>
          {book.why ? (
            <p className="text-text-2 text-[12.5px] leading-relaxed sm:line-clamp-2">
              {book.why}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <PriorityChip priority={book.priority} size="sm" />
            {book.priority === 'lido' && book.has_notes === false ? (
              <PendingNotesChip size="sm" />
            ) : null}
            {book.rating != null ? (
              <GradeChip value={book.rating} size="sm" />
            ) : null}
            {book.categories.map((c) => (
              <CategoryChip
                key={c}
                category={c}
                color={categoryColors?.[c]}
                size="sm"
              />
            ))}
          </div>
        </div>
        <div className="text-text-3 hidden shrink-0 flex-col items-end gap-1 text-[11.5px] sm:flex">
          {dateLabel ? (
            <>
              <span className="text-text-3/80 text-[10.5px] uppercase tracking-[0.06em]">
                {dateContext}
              </span>
              <span className="text-text-2 text-[12.5px] tabular-nums">{dateLabel}</span>
            </>
          ) : null}
        </div>
      </Link>
      <button
        type="button"
        aria-label={`Edit ${book.title}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onEdit(book);
        }}
        className={cn(
          'text-text-3 hover:text-text hover:bg-surface-2 absolute right-3 top-3 rounded-md p-1.5 opacity-0 transition-opacity',
          'group-hover:opacity-100 focus-visible:opacity-100',
        )}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
