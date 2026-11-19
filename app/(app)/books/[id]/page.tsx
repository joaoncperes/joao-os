import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getBookCategoryData } from '@/lib/book-categories';
import type { Book, BookNote, TipTapDoc } from '@/lib/supabase/types';
import { Breadcrumb } from '@/components/breadcrumb';
import { BookDetailClient } from './book-detail-client';

export const dynamic = 'force-dynamic';

const EMPTY_DOC: TipTapDoc = { type: 'doc', content: [] };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('books')
    .select('title')
    .eq('id', id)
    .maybeSingle();
  return {
    title: data?.title ? `${data.title} — João OS` : 'Book — João OS',
  };
}

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: bookRow }, { data: notesRow }, categoryData] = await Promise.all([
    supabase
      .from('books')
      .select(
        'id, user_id, title, author, priority, categories, why, started_at, finished_at, finished_year, finished_month, finished_month_estimated, rating, position, created_at, updated_at',
      )
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('book_notes')
      .select('id, user_id, book_id, content_json, content_md, tags, created_at, updated_at')
      .eq('book_id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
    getBookCategoryData(),
  ]);

  if (!bookRow) notFound();

  const book = bookRow as Book;
  const initialContent: TipTapDoc =
    (notesRow?.content_json as TipTapDoc | null) ?? EMPTY_DOC;
  const initialMd: string = (notesRow as BookNote | null)?.content_md ?? '';
  const initialTags: string[] = (notesRow as BookNote | null)?.tags ?? [];

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Second Brain', href: '/second-brain' },
          { label: 'Resources', href: '/second-brain/resources' },
          { label: 'Books', href: '/books' },
          { label: book.title },
        ]}
      />
      <BookDetailClient
        book={book}
        initialContent={initialContent}
        initialMd={initialMd}
        initialTags={initialTags}
        categoryData={categoryData}
      />
    </>
  );
}
