'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, Pencil, Rocket, EyeOff, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ArticleFormDialog } from '@/components/article-form-dialog';
import { ArticleContentEditor } from '@/components/article-content-editor';
import { publishArticle, unpublishArticle } from '@/app/(app)/blog/actions';
import type { Article, TipTapDoc } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

interface Props {
  article: Article;
  initialContent: TipTapDoc;
  initialMd: string;
}

const STATUS_BADGE: Record<Article['status'], string> = {
  published: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  draft: 'bg-amber-100 text-amber-900 ring-1 ring-amber-200',
  archived: 'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200',
};
const STATUS_LABEL: Record<Article['status'], string> = {
  published: 'Live',
  draft: 'Draft',
  archived: 'Archived',
};

export function ArticleEditorClient({ article, initialContent, initialMd }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const isPublished = article.status === 'published';
  const liveUrl = article.published_slug
    ? `https://example.com/articles/${article.published_slug}`
    : null;

  function publish() {
    startTransition(async () => {
      const res = await publishArticle(article.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(isPublished ? 'Updated — live in ~1 min.' : 'Published — live in ~1 min.');
      router.refresh();
    });
  }

  function unpublish() {
    if (!confirm('Take this post off example.com? The draft stays here.')) return;
    startTransition(async () => {
      const res = await unpublishArticle(article.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Unpublished — removed from the blog in ~1 min.');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/blog"
          className="text-text-3 hover:text-text inline-flex items-center gap-1 text-[12.5px] font-medium"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Blog
        </Link>
      </div>

      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2">
              <span
                className={cn(
                  'rounded-md px-2 py-0.5 text-[11px] font-semibold',
                  STATUS_BADGE[article.status],
                )}
              >
                {STATUS_LABEL[article.status]}
              </span>
              <span className="text-text-3 text-[12px]">/{article.slug}</span>
            </div>
            <h1 className="text-text text-[28px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[32px]">
              {article.title}
            </h1>
            {article.summary ? (
              <p className="text-text-3 mt-1.5 max-w-prose text-[14px]">{article.summary}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)} disabled={pending}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
            {isPublished && liveUrl ? (
              <Button
                variant="outline"
                onClick={() => window.open(liveUrl, '_blank', 'noopener')}
                disabled={pending}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                View live
              </Button>
            ) : null}
            {isPublished ? (
              <Button variant="outline" onClick={unpublish} disabled={pending}>
                <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                Unpublish
              </Button>
            ) : null}
            <Button onClick={publish} disabled={pending}>
              <Rocket className="mr-1.5 h-3.5 w-3.5" />
              {pending ? 'Working…' : isPublished ? 'Update live' : 'Publish'}
            </Button>
          </div>
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-text text-[15px] font-semibold tracking-[-0.005em]">Content</h2>
        <ArticleContentEditor
          articleId={article.id}
          initialContent={initialContent}
          initialMd={initialMd}
        />
      </section>

      <ArticleFormDialog open={editOpen} onOpenChange={setEditOpen} article={article} />
    </div>
  );
}
