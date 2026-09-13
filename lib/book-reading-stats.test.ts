import assert from 'node:assert/strict';
import { getBookReadingStats } from './book-reading-stats';
import { dateInTz } from './date';
import { formatBookFinishedDate } from './books-display';

const books = [
  { priority: 'lido' as const, finished_at: '2025-12-31' },
  { priority: 'lido' as const, finished_at: '2026-01-01' },
  { priority: 'lido' as const, finished_at: '2026-09-10' },
  { priority: 'lido' as const, finished_at: null },
  { priority: 'lendo' as const, finished_at: '2026-02-01' },
  { priority: 'alta' as const, finished_at: null },
];
const stats = getBookReadingStats(books, '2026-09-10');
assert.equal(stats.lifetime, 4);
assert.equal(stats.thisYear, 2);
assert.equal(stats.undated, 1);
assert.deepEqual(stats.monthly, [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]);
assert.equal(getBookReadingStats(books, '2026-01-01').thisYear, 1, 'Future dates do not count yet');
assert.equal(getBookReadingStats(books, dateInTz('2026-01-01T02:59:59Z')).year, 2025);
assert.equal(getBookReadingStats(books, dateInTz('2026-01-01T03:00:00Z')).year, 2026);
assert.deepEqual(getBookReadingStats([], '2026-09-10'), {
  year: 2026, lifetime: 0, undated: 0, yearOnly: 0, monthly: Array(12).fill(0), thisYear: 0,
});
const historical = getBookReadingStats([
  ...books,
  { priority: 'lido', finished_at: null, finished_year: 2026 },
  { priority: 'lido', finished_at: null, finished_year: 2025 },
  { priority: 'lido', finished_at: '2026-03-01', finished_year: 2026 },
  { priority: 'lendo', finished_at: null, finished_year: 2026 },
], '2026-09-10');
assert.equal(historical.lifetime, 7);
assert.equal(historical.thisYear, 4, 'Exact dates and year-only entries count once each');
assert.equal(historical.yearOnly, 1);
assert.equal(historical.undated, 1, 'Known years are not counted as missing');
assert.equal(historical.monthly.reduce((a, b) => a + b, 0), 3, 'Year-only entries do not fabricate monthly data');
console.log('Book reading stats tests passed');
const monthStats = getBookReadingStats([
  { priority: 'lido', finished_at: '2026-01-26' },
  { priority: 'lido', finished_at: null, finished_year: 2026, finished_month: 1 },
  { priority: 'lido', finished_at: null, finished_year: 2026, finished_month: 2, finished_month_estimated: true },
  { priority: 'lido', finished_at: null, finished_year: 2026, finished_month: 12, finished_month_estimated: true },
  { priority: 'lido', finished_at: null, finished_year: 2025, finished_month: 2, finished_month_estimated: true },
], '2026-09-10');
assert.equal(monthStats.thisYear, 3, 'Month-only completions count in the year; future and previous-year months do not');
assert.equal(monthStats.yearOnly, 0);
assert.deepEqual(monthStats.monthly, [2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
assert.equal(formatBookFinishedDate({finished_at: null, finished_year: 2026, finished_month: 1}), 'January 2026');
assert.equal(formatBookFinishedDate({finished_at: null, finished_year: 2026, finished_month: 2, finished_month_estimated: true}), 'February 2026');
console.log('Book reading month tests passed');
