import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getBookCategoryData } from '@/lib/book-categories';
import type { Book } from '@/lib/supabase/types';
import { ReadingLogCard, type ReadingSessionRow } from '@/components/reading-log-card';
import { mondayOf } from '@/lib/goals';
import { BooksClient } from './books-client';
import { todayInTz } from '@/lib/date';

export const metadata = { title: 'Livros — João OS' };
export const dynamic = 'force-dynamic';

// Grade comes from the URL (?grade=8). Accept only an integer in 0–10; anything
// else (junk, out of range) means "no minimum".
function parseGradeParam(raw: string | undefined): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : null;
}

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<{
    priority?: string;
    category?: string;
    q?: string;
    grade?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data, error }, { data: notedRows }, categoryData, { data: profile }] = await Promise.all([
    supabase
      .from('books')
      .select(
        'id, user_id, title, author, priority, categories, why, started_at, finished_at, finished_year, finished_month, finished_month_estimated, rating, position, created_at, updated_at',
      )
      .order('finished_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false }),
    supabase
      .from('book_notes')
      .select('book_id')
      .eq('user_id', user.id)
      .neq('content_md', ''),
    getBookCategoryData(),
    supabase.from('users').select('time_zone').eq('id', user.id).maybeSingle(),
  ]);

  const today = todayInTz(profile?.time_zone ?? undefined);
  const weekStart = mondayOf(today);
  const [{ data: readingRows }, { data: readingGoal }] = await Promise.all([
    supabase
      .from('reading_sessions')
      .select('id, session_date, minutes, created_at, book:books(title)')
      .eq('user_id', user.id)
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('goals')
      .select('target_value')
      .eq('user_id', user.id)
      .eq('kind', 'weekly')
      .eq('metric', 'reading_minutes')
      .is('archived_at', null)
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  type ReadingRaw = {
    id: string;
    session_date: string;
    minutes: number;
    book: { title: string } | { title: string }[] | null;
  };
  const readingAll: ReadingSessionRow[] = ((readingRows ?? []) as ReadingRaw[]).map((r) => {
    const book = Array.isArray(r.book) ? r.book[0] : r.book;
    return {
      id: r.id,
      session_date: r.session_date,
      minutes: Number(r.minutes),
      book_title: book?.title ?? null,
    };
  });
  const weekMinutes = readingAll
    .filter((r) => r.session_date >= weekStart)
    .reduce((s, r) => s + r.minutes, 0);

  const noted = new Set(
    ((notedRows ?? []) as Array<{ book_id: string }>).map((n) => n.book_id),
  );
  const books: Book[] = (data ?? []).map((b) => ({
    ...(b as Book),
    has_notes: noted.has((b as Book).id),
  }));

  const readingBooks = books
    .filter((b) => b.priority === 'lendo')
    .map((b) => ({ id: b.id, title: b.title }));

  return (
    <div className="flex flex-col gap-7">
      <ReadingLogCard
        today={today}
        books={readingBooks}
        recent={readingAll.slice(0, 7)}
        weekMinutes={weekMinutes}
        weekTarget={
          (readingGoal as { target_value: number } | null)?.target_value != null
            ? Number((readingGoal as { target_value: number }).target_value)
            : null
        }
      />
      <BooksClient
        initialBooks={books}
        loadError={error?.message ?? null}
        initialPriority={params.priority ?? null}
        initialCategory={params.category ?? null}
        initialQuery={params.q ?? ''}
        initialMinGrade={parseGradeParam(params.grade)}
        initialSort={params.sort === 'grade' ? 'grade' : 'priority'}
        categoryData={categoryData}
        today={today}
      />
    </div>
  );
}
