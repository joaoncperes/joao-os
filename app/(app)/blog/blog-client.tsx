'use client';

import { useMemo, useState, useDeferredValue } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArticleFormDialog } from '@/components/article-form-dialog';
import type { ArticleListItem, ArticleStatus } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

interface Props {
  initialArticles: ArticleListItem[];
  loadError: string | null;
}

const STATUS_ORDER: ArticleStatus[] = ['published', 'draft', 'archived'];
const STATUS_HEADING: Record<ArticleStatus, string> = {
  published: 'Published',
  draft: 'Drafts',
  archived: 'Archived',
};
const STATUS_BADGE: Record<ArticleStatus, string> = {
  published: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  draft: 'bg-amber-100 text-amber-900 ring-1 ring-amber-200',
  archived: 'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200',
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function BlogClient({ initialArticles, loadError }: Props) {
  const router = useRouter();
  const [articles] = useState<ArticleListItem[]>(initialArticles);
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const [formOpen, setFormOpen] = useState(false);

  const filtered = useMemo(() => {
    return articles
      .filter((a) => (statusFilter ? a.status === statusFilter : true))
      .filter((a) => {
        if (!deferredQuery) return true;
        const hay = `${a.title} ${a.slug} ${a.summary ?? ''}`.toLowerCase();
        return hay.includes(deferredQuery);
      });
  }, [articles, statusFilter, deferredQuery]);

  const grouped = useMemo(() => {
    const buckets = new Map<ArticleStatus, ArticleListItem[]>();
    for (const a of filtered) {
      const list = buckets.get(a.status) ?? [];
      list.push(a);
      buckets.set(a.status, list);
    }
    return STATUS_ORDER.flatMap((s) =>
      buckets.get(s)?.length ? [{ status: s, items: buckets.get(s)! }] : [],
    );
  }, [filtered]);

  const counts = useMemo(() => {
    const published = articles.filter((a) => a.status === 'published').length;
    const draft = articles.filter((a) => a.status === 'draft').length;
    return { total: articles.length, published, draft };
  }, [articles]);

  const filtersOn = statusFilter != null || searchQuery.trim().length > 0;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-text-3 mb-1.5 text-[13px] font-medium uppercase tracking-[0.02em]">
            Blog
          </div>
          <h1 className="text-text text-[30px] font-semibold leading-[1.1] tracking-[-0.02em]">
            Articles
          </h1>
          <p className="text-text-3 mt-2 text-[13px]">
            {counts.total} posts · {counts.published} published · {counts.draft} drafts
            <span className="text-text-3/70"> · example.com</span>
          </p>
        </div>
        <Button
          onClick={() => setFormOpen(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New
        </Button>
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter(null)}
            className={cn(
              'rounded-md px-2.5 py-1 text-[12px] font-semibold ring-1 transition-colors',
              statusFilter == null
                ? 'bg-accent text-accent-foreground ring-accent'
                : 'bg-surface-2 text-text-2 ring-border hover:text-text',
            )}
          >
            All
          </button>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter((prev) => (prev === s ? null : s))}
              className={cn(
                'rounded-md px-2.5 py-1 text-[12px] font-semibold ring-1 transition-colors',
                statusFilter === s
                  ? 'bg-accent text-accent-foreground ring-accent'
                  : 'bg-surface-2 text-text-2 ring-border hover:text-text',
              )}
            >
              {STATUS_HEADING[s]}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="text-text-3 absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            placeholder="Filter by title, slug, or summary…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-text-3 hover:text-text absolute right-3 top-1/2 -translate-y-1/2"
              aria-label="Clear filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {loadError ? (
        <div className="bg-surface border-border text-destructive rounded-xl border p-4 text-sm">
          {loadError}
        </div>
      ) : grouped.length === 0 ? (
        <div className="bg-surface border-border text-text-3 rounded-xl border px-5 py-10 text-center text-[13px]">
          {filtersOn ? 'No posts match your filters.' : 'No posts yet — tap New to write one.'}
        </div>
      ) : (
        <div className="flex flex-col gap-7">
          {grouped.map(({ status, items }) => (
            <section key={status} className="flex flex-col gap-3">
              <h2 className="text-text text-[14px] font-semibold tracking-[-0.005em]">
                {STATUS_HEADING[status]}
                <span className="text-text-3 ml-2 text-[12px] font-normal">
                  {items.length}
                </span>
              </h2>
              <ul className="flex flex-col gap-2">
                {items.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => router.push(`/blog/${a.id}`)}
                      className="bg-surface border-border hover:border-border-strong flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-text truncate text-[14.5px] font-semibold tracking-[-0.005em]">
                          {a.title || 'Untitled'}
                        </div>
                        <div className="text-text-3 mt-0.5 truncate text-[12px]">
                          /{a.slug}
                          {a.summary ? <span className="text-text-3/70"> · {a.summary}</span> : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-[11px] font-semibold',
                            STATUS_BADGE[a.status],
                          )}
                        >
                          {a.status === 'published' ? 'Live' : STATUS_HEADING[a.status].replace(/s$/, '')}
                        </span>
                        <time className="text-text-3 hidden text-[11.5px] tabular-nums sm:inline">
                          {formatDate(a.status === 'published' ? a.published_at : a.updated_at)}
                        </time>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ArticleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        article={null}
        onSaved={(id) => router.push(`/blog/${id}`)}
      />
    </div>
  );
}
