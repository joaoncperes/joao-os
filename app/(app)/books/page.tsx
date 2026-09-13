import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getBookCategoryData } from '@/lib/book-categories';
import type { Book } from '@/lib/supabase/types';
import { Breadcrumb } from '@/components/breadcrumb';
import { BooksClient } from './books-client';
import { todayInTz } from '@/lib/date';

export const metadata = { title: 'Books — Pedro OS' };
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

  const noted = new Set(
    ((notedRows ?? []) as Array<{ book_id: string }>).map((n) => n.book_id),
  );
  const books: Book[] = (data ?? []).map((b) => ({
    ...(b as Book),
    has_notes: noted.has((b as Book).id),
  }));

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Second Brain', href: '/second-brain' },
          { label: 'Resources', href: '/second-brain/resources' },
          { label: 'Books' },
        ]}
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
        today={todayInTz(profile?.time_zone ?? undefined)}
      />
    </>
  );
}
