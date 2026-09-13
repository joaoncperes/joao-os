import { BookOpenCheck, CalendarDays } from 'lucide-react';
import { getBookReadingStats } from '@/lib/book-reading-stats';
import type { Book } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function BookReadingStats({ books, today }: { books: Book[]; today: string }) {
  const stats = getBookReadingStats(books, today);
  const currentMonth = Number(today.slice(5, 7)) - 1;
  const peak = Math.max(1, ...stats.monthly);

  return (
    <section aria-label="Your reading journey" className="flex flex-col gap-2.5">
      <div className="grid gap-3 sm:grid-cols-[1fr_1.8fr]">
        <div className="border-border bg-surface relative overflow-hidden rounded-2xl border p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-text-2 text-[12px] font-medium">Books read · All time</h2>
            <span className="bg-success-soft text-success flex size-8 items-center justify-center rounded-lg">
              <BookOpenCheck className="size-4" aria-hidden="true" />
            </span>
          </div>
          <p className="text-text mt-3 text-[48px] font-semibold leading-none tracking-[-0.055em] tabular-nums">
            {stats.lifetime}
          </p>
          <p className="text-text-3 mt-3 text-[12px]">A lifetime of turning pages.</p>
        </div>

        <div className="border-accent/20 bg-accent-tint rounded-2xl border p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-accent text-[12px] font-medium">Books read · This year</h2>
            <span className="text-accent bg-accent-soft inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums">
              <CalendarDays className="size-3" aria-hidden="true" />
              {stats.year}
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-5 min-[480px]:flex-row min-[480px]:items-end min-[480px]:gap-7">
            <div className="shrink-0">
              <p className="text-accent text-[48px] font-semibold leading-none tracking-[-0.055em] tabular-nums">
                {stats.thisYear}
              </p>
              <p className="text-text-3 mt-3 text-[12px]">Finished in {stats.year}</p>
            </div>
            <div className="min-w-0 flex-1" role="img" aria-label={`Books finished each month in ${stats.year}: ${MONTHS.map((month, i) => `${month}: ${stats.monthly[i]}`).join(', ')}`}>
              <div className="flex h-[86px] items-end gap-1.5" aria-hidden="true">
                {MONTHS.map((month, i) => (
                  <div key={month} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${month} ${stats.year}: ${stats.monthly[i]} books`}>
                    <span className="text-accent h-3 text-[9px] font-semibold tabular-nums">
                      {stats.monthly[i] || ''}
                    </span>
                    <div className={cn('w-full max-w-6 rounded-t-[3px]', i > currentMonth ? 'bg-accent/5' : stats.monthly[i] ? 'bg-accent/65' : 'bg-accent/15', i === currentMonth && stats.monthly[i] > 0 && 'bg-accent')}
                      style={{ height: stats.monthly[i] ? `${(stats.monthly[i] / peak) * 46}px` : '3px' }} />
                    <span className={cn('mt-1 text-[9px]', i === currentMonth ? 'text-accent font-semibold' : 'text-text-3')}>{month}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {stats.yearOnly > 0 && (
        <p className="text-text-3 px-1 text-[11px]">
          {stats.yearOnly} {stats.yearOnly === 1 ? 'book is' : 'books are'} included in {stats.year} with no month recorded. The chart shows dated books only.
        </p>
      )}
      {stats.undated > 0 && (
        <p className="text-text-3 px-1 text-[11px]">
          {stats.undated} {stats.undated === 1 ? 'read book has' : 'read books have'} no finish year. Included in all time only.
        </p>
      )}
    </section>
  );
}
