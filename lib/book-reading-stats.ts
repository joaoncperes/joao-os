import type { Book } from './supabase/types';

type ReadingBook = Pick<Book, 'priority' | 'finished_at' | 'finished_year' | 'finished_month' | 'finished_month_estimated'>;

/** Calendar dates stay as strings: converting them to UTC shifts local years. */
export function getBookReadingStats(books: ReadingBook[], today: string) {
  const year = Number(today.slice(0, 4));
  const monthly = Array<number>(12).fill(0);
  const currentMonth = Number(today.slice(5, 7));
  let lifetime = 0;
  let undated = 0;
  let yearOnly = 0;

  for (const book of books) {
    if (book.priority !== 'lido') continue;
    lifetime++;
    if (!book.finished_at) {
      if (book.finished_year === year) {
        if (book.finished_month == null) yearOnly++;
        else if (book.finished_month >= 1 && book.finished_month <= currentMonth) {
          monthly[book.finished_month - 1]++;
        }
      }
      else if (book.finished_year == null) undated++;
      continue;
    }
    if (book.finished_at.slice(0, 4) !== String(year) || book.finished_at > today) continue;
    const month = Number(book.finished_at.slice(5, 7)) - 1;
    if (month >= 0 && month < 12) monthly[month]++;
  }

  return { year, lifetime, undated, yearOnly, monthly, thisYear: yearOnly + monthly.reduce((a, b) => a + b, 0) };
}
