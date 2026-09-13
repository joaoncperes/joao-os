import Link from 'next/link';
import { BookOpen, ArrowRight } from 'lucide-react';
import { CategoryChip } from '@/components/category-chip';
import { formatReadingDate } from '@/lib/books-display';
import type { Book } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

interface Props {
  books: Pick<
    Book,
    'id' | 'title' | 'author' | 'why' | 'categories' | 'started_at'
  >[];
}

export function CurrentlyReadingCard({ books }: Props) {
  if (books.length === 0) {
    return (
      <section className="bg-surface border-border rounded-xl border px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-text-3 mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em]">
              Currently reading
            </div>
            <div className="text-text-2 text-[13px]">
              Nothing in progress — pick a book from your queue.
            </div>
          </div>
          <Link
            href="/books"
            className="text-accent hover:text-accent/80 inline-flex items-center gap-1 text-[12px] font-semibold"
          >
            Books
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <div className="text-text-3 text-[10.5px] font-semibold uppercase tracking-[0.08em]">
          Currently reading
        </div>
        <Link
          href="/books"
          className="text-accent hover:text-accent/80 inline-flex items-center gap-1 text-[11.5px] font-semibold"
        >
          All books
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <ul
        className={cn(
          'grid gap-2',
          books.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2',
        )}
      >
        {books.map((b) => (
          <li key={b.id}>
            <Link
              href={`/books/${b.id}`}
              className="bg-surface border-border hover:bg-surface-2/60 flex h-full items-start gap-3 rounded-xl border px-4 py-3 transition-colors"
            >
              <span className="bg-amber-100 text-amber-700 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-amber-200">
                <BookOpen className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-text text-[14px] font-semibold leading-tight">
                  {b.title}
                </div>
                {b.author ? (
                  <div className="text-text-3 mt-0.5 text-[11.5px]">{b.author}</div>
                ) : null}
                {b.why ? (
                  <p className="text-text-2 mt-1.5 line-clamp-2 text-[12px] leading-relaxed">
                    {b.why}
                  </p>
                ) : null}
                {b.categories.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {b.categories.slice(0, 3).map((c) => (
                      <CategoryChip key={c} category={c} size="sm" />
                    ))}
                  </div>
                ) : null}
              </div>
              {b.started_at ? (
                <span className="text-text-3 hidden text-[10.5px] whitespace-nowrap tabular-nums sm:block">
                  {formatReadingDate(b.started_at)}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
