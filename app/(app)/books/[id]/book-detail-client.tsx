'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Pencil, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PriorityChip } from '@/components/priority-chip';
import { CategoryChip } from '@/components/category-chip';
import type { BookCategoryData } from '@/lib/book-categories';
import { PendingNotesChip } from '@/components/pending-notes-chip';
import { BookFormDialog } from '@/components/book-form-dialog';
import { BookNotesEditor } from '@/components/book-notes-editor';
import { TagChip } from '@/components/tag-chip';
import { bookSlug, formatBookFinishedDate, formatReadingDate, PRIORITY_LABEL } from '@/lib/books-display';
import type { Book, TipTapDoc } from '@/lib/supabase/types';

interface Props {
  book: Book;
  initialContent: TipTapDoc;
  initialMd: string;
  initialTags: string[];
  categoryData: BookCategoryData;
}

export function BookDetailClient({
  book,
  initialContent,
  initialMd,
  initialTags,
  categoryData,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [liveTags, setLiveTags] = useState<string[]>(initialTags);
  const dateLabel =
    formatBookFinishedDate(book) || formatReadingDate(book.started_at);
  const dateContext = book.finished_at
    ? 'Read on'
    : book.finished_year
    ? 'Read in'
    : book.started_at
    ? 'Started'
    : null;

  function exportMarkdown() {
    const md = mdHeader(book) + '\n\n' + (initialMd || '*No notes yet.*') + '\n';
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bookSlug(book.title) || 'book'}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/books"
          className="text-text-3 hover:text-text inline-flex items-center gap-1 text-[12.5px] font-medium"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Books
        </Link>
      </div>

      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-text-3 mb-1.5 text-[11.5px] font-medium uppercase tracking-[0.06em]">
              Book
            </div>
            <h1 className="text-text text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[32px]">
              {book.title}
            </h1>
            {book.author ? (
              <div className="text-text-3 mt-1 text-[14px]">{book.author}</div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportMarkdown}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Markdown
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityChip priority={book.priority} />
          {book.priority === 'lido' && initialMd.trim().length === 0 ? (
            <PendingNotesChip />
          ) : null}
          {book.categories.map((c) => (
            <CategoryChip key={c} category={c} color={categoryData.colorMap[c]} />
          ))}
          {dateLabel ? (
            <span className="text-text-3 ml-1 text-[12px]">
              <span className="text-text-3/70 uppercase tracking-[0.06em] text-[10.5px]">
                {dateContext}
              </span>{' '}
              <span className="text-text-2 tabular-nums">{dateLabel}</span>
            </span>
          ) : null}
        </div>

        {book.why ? (
          <div className="bg-surface border-border rounded-xl border px-4 py-3">
            <div className="text-text-3 mb-1 text-[10.5px] font-semibold uppercase tracking-[0.06em]">
              Why?
            </div>
            <p className="text-text-2 text-[13.5px] leading-relaxed whitespace-pre-line">
              {book.why}
            </p>
          </div>
        ) : null}
      </header>

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-text text-[15px] font-semibold tracking-[-0.005em]">
            Notes
          </h2>
          {liveTags.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-1.5">
              {liveTags.map((t) => (
                <TagChip key={t} tag={t} size="sm" />
              ))}
            </div>
          ) : null}
        </div>
        <BookNotesEditor
          bookId={book.id}
          initialContent={initialContent}
          onTagsChange={setLiveTags}
        />
      </section>

      <BookFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        book={book}
        categories={categoryData.categories}
        categoryCounts={categoryData.counts}
      />
    </div>
  );
}

function mdHeader(book: Book): string {
  const lines = [`# ${book.title}`];
  if (book.author) lines.push(`*${book.author}*`);
  const meta: string[] = [];
  meta.push(`**Priority:** ${PRIORITY_LABEL[book.priority]}`);
  if (book.categories.length > 0) {
    meta.push(`**Category:** ${book.categories.join(', ')}`);
  }
  if (book.finished_at) meta.push(`**Read on:** ${book.finished_at}`);
  else if (book.finished_year) meta.push(`**Read in:** ${formatBookFinishedDate(book)}`);
  if (book.started_at) meta.push(`**Started:** ${book.started_at}`);
  if (book.why) meta.push(`\n> ${book.why.replace(/\n/g, '\n> ')}`);
  return [lines.join('\n'), meta.join('  \n')].filter(Boolean).join('\n\n');
}
