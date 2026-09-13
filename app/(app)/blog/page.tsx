import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ArticleListItem } from '@/lib/supabase/types';
import { Breadcrumb } from '@/components/breadcrumb';
import { BlogClient } from './blog-client';

export const metadata = { title: 'Blog — Pedro OS' };
export const dynamic = 'force-dynamic';

// List projection — never select the heavy content_json/content_md columns.
const LIST_COLUMNS =
  'id, user_id, title, slug, summary, status, published_at, published_slug, published_path, published_commit_sha, created_at, updated_at';

export default async function BlogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('articles')
    .select(LIST_COLUMNS)
    .order('updated_at', { ascending: false });

  const articles = (data ?? []) as ArticleListItem[];

  return (
    <>
      <Breadcrumb items={[{ label: 'Blog' }]} />
      <BlogClient initialArticles={articles} loadError={error?.message ?? null} />
    </>
  );
}
