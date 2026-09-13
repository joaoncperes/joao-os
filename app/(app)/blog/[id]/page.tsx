import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Article, TipTapDoc } from '@/lib/supabase/types';
import { Breadcrumb } from '@/components/breadcrumb';
import { ArticleEditorClient } from './article-editor-client';

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
    .from('articles')
    .select('title')
    .eq('id', id)
    .maybeSingle();
  return {
    title: data?.title ? `${data.title} — Pedro OS` : 'Article — Pedro OS',
  };
}

export default async function ArticleDetailPage({
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

  const { data } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) notFound();

  const article = data as Article;
  // Hydrate the editor from JSON when it exists, else from the raw markdown
  // (the imported-from-blog case — content_json is still the empty doc).
  const initialContent: TipTapDoc =
    (article.content_json as TipTapDoc | null) ?? EMPTY_DOC;

  return (
    <>
      <Breadcrumb
        items={[{ label: 'Blog', href: '/blog' }, { label: article.title }]}
      />
      <ArticleEditorClient
        article={article}
        initialContent={initialContent}
        initialMd={article.content_md}
      />
    </>
  );
}
