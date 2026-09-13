'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createArticle,
  updateArticleMeta,
  deleteArticle,
} from '@/app/(app)/blog/actions';
import { articleSlug } from '@/lib/blog-slug';
import type { ArticleListItem } from '@/lib/supabase/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article?: ArticleListItem | null;
  onSaved?: (id: string) => void;
}

interface FormState {
  title: string;
  slug: string;
  summary: string;
}

function fromArticle(a: ArticleListItem | null | undefined): FormState {
  if (!a) return { title: '', slug: '', summary: '' };
  return { title: a.title, slug: a.slug, summary: a.summary ?? '' };
}

export function ArticleFormDialog({ open, onOpenChange, article, onSaved }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>(() => fromArticle(article));
  // Once the slug is hand-edited (or we're editing an existing post) we stop
  // auto-deriving it from the title.
  const [slugTouched, setSlugTouched] = useState<boolean>(!!article);

  // React 19 — reset internal state during render when the inputs change.
  const [lastSig, setLastSig] = useState(`${open}|${article?.id ?? ''}`);
  const sig = `${open}|${article?.id ?? ''}`;
  if (lastSig !== sig) {
    setLastSig(sig);
    if (open) {
      setState(fromArticle(article));
      setSlugTouched(!!article);
    }
  }

  function onChangeTitle(value: string) {
    setState((s) => ({
      ...s,
      title: value,
      slug: slugTouched ? s.slug : articleSlug(value),
    }));
  }

  function onChangeSlug(value: string) {
    setSlugTouched(true);
    setState((s) => ({ ...s, slug: value }));
  }

  const finalSlug = articleSlug(state.slug || state.title);
  const slugWillMoveLiveUrl =
    !!article &&
    article.status === 'published' &&
    !!article.published_slug &&
    finalSlug !== article.published_slug;

  function onSubmit() {
    if (!state.title.trim()) {
      toast.error('Title is required.');
      return;
    }
    startTransition(async () => {
      if (article) {
        const res = await updateArticleMeta(article.id, state);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success('Post updated.');
        onOpenChange(false);
        onSaved?.(article.id);
      } else {
        const res = await createArticle(state);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success('Draft created.');
        onOpenChange(false);
        onSaved?.(res.data.id);
      }
      router.refresh();
    });
  }

  function onDelete() {
    if (!article) return;
    const live = article.status === 'published';
    if (
      !confirm(
        live
          ? `Delete "${article.title}"? This also removes it from example.com.`
          : `Delete "${article.title}"?`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteArticle(article.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Post deleted.');
      onOpenChange(false);
      router.push('/blog');
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{article ? 'Edit post' : 'New post'}</DialogTitle>
          <DialogDescription>
            {article ? 'Update title, slug, and summary.' : 'Start a new draft.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={state.title}
              onChange={(e) => onChangeTitle(e.target.value)}
              placeholder="Post title"
              disabled={pending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slug">Slug</Label>
            <div className="flex items-center gap-2">
              <span className="text-text-3 shrink-0 text-[12px]">/articles/</span>
              <Input
                id="slug"
                value={state.slug}
                onChange={(e) => onChangeSlug(e.target.value)}
                placeholder="my-post"
                disabled={pending}
                className="font-mono text-[13px]"
              />
            </div>
            {finalSlug && finalSlug !== state.slug ? (
              <p className="text-text-3 text-[11.5px]">
                Will be saved as <span className="font-mono">{finalSlug}</span>
              </p>
            ) : null}
            {slugWillMoveLiveUrl ? (
              <p className="text-[11.5px] text-amber-700">
                Changing the slug moves the live URL on the next publish and removes the
                old one.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="summary">Summary</Label>
            <textarea
              id="summary"
              value={state.summary}
              onChange={(e) => setState({ ...state, summary: e.target.value })}
              placeholder="Short description (shown as the post's meta description)."
              disabled={pending}
              rows={3}
              className="bg-surface-2 border-border focus-visible:ring-accent rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1"
            />
          </div>
        </div>

        <DialogFooter>
          {article ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onDelete}
              disabled={pending}
              className="text-destructive hover:text-destructive mr-auto"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Delete
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? 'Saving…' : article ? 'Save' : 'Create draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
