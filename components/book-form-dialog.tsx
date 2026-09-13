'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Settings2, Trash2 } from 'lucide-react';
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
import { GradePicker } from '@/components/ui/grade-picker';
import { CategoryChip } from '@/components/category-chip';
import { ManageBookCategories } from '@/components/manage-book-categories';
import { formatBookFinishedDate, PRIORITY_LABEL, PRIORITY_ORDER } from '@/lib/books-display';
import {
  type BookInput,
  createBook,
  createBookCategory,
  updateBook,
  deleteBook,
} from '@/app/(app)/books/actions';
import type { Book, BookCategory, BookPriority } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  book?: Book | null;
  onSaved?: (id: string) => void;
  /** Vocabulary + per-name book counts, fetched by the parent page. */
  categories: BookCategory[];
  categoryCounts: Record<string, number>;
}

const EMPTY: BookInput = {
  title: '',
  author: null,
  priority: 'media',
  categories: [],
  why: null,
  started_at: null,
  finished_at: null,
  rating: null,
};

function fromBook(book: Book | null | undefined): BookInput {
  if (!book) return EMPTY;
  return {
    title: book.title,
    author: book.author,
    priority: book.priority,
    categories: book.categories,
    why: book.why,
    started_at: book.started_at,
    finished_at: book.finished_at,
    rating: book.rating,
  };
}

export function BookFormDialog({
  open,
  onOpenChange,
  book,
  onSaved,
  categories,
  categoryCounts,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<BookInput>(() => fromBook(book));
  const [customCategory, setCustomCategory] = useState('');
  const [managing, setManaging] = useState(false);

  // The vocabulary is user-owned, so it comes from the DB — fetched by the
  // server component and handed down, per the project's fetch/interact split.
  // Mutations call router.refresh(), which re-runs the page and rewrites these.
  const vocab = categories;

  // React 19 pattern — reset internal state during render when the inputs
  // we depend on change. Cheaper and safer than mirroring via useEffect.
  const [lastSig, setLastSig] = useState(`${open}|${book?.id ?? ''}`);
  const sig = `${open}|${book?.id ?? ''}`;
  if (lastSig !== sig) {
    setLastSig(sig);
    if (open) {
      setState(fromBook(book));
      setCustomCategory('');
      setManaging(false);
    }
  }

  function toggleCategory(category: string) {
    setState((s) => ({
      ...s,
      categories: s.categories.includes(category)
        ? s.categories.filter((c) => c !== category)
        : [...s.categories, category],
    }));
  }

  // Persists to the vocabulary *and* tags the open book. Before, this only
  // touched local state — which is why a custom category vanished the next
  // time the dialog opened on a different book.
  function addCustomCategory() {
    const c = customCategory.trim();
    if (!c) return;

    const existing = vocab.find((v) => v.name.toLowerCase() === c.toLowerCase());
    if (existing) {
      setCustomCategory('');
      setState((s) =>
        s.categories.includes(existing.name)
          ? s
          : { ...s, categories: [...s.categories, existing.name] },
      );
      return;
    }

    setCustomCategory('');
    startTransition(async () => {
      const res = await createBookCategory(c);
      if (!res.ok) {
        toast.error(res.error);
        setCustomCategory(c);
        return;
      }
      const name = res.data.name;
      setState((s) =>
        s.categories.includes(name) ? s : { ...s, categories: [...s.categories, name] },
      );
      router.refresh();
    });
  }

  async function onSubmit() {
    if (!state.title.trim()) {
      toast.error('Title is required.');
      return;
    }
    startTransition(async () => {
      if (book) {
        const res = await updateBook(book.id, state);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success('Book updated.');
        onOpenChange(false);
        onSaved?.(book.id);
      } else {
        const res = await createBook(state);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success('Book added.');
        onOpenChange(false);
        onSaved?.(res.data.id);
      }
      router.refresh();
    });
  }

  async function onDelete() {
    if (!book) return;
    if (!confirm(`Delete "${book.title}" and all its notes?`)) return;
    startTransition(async () => {
      const result = await deleteBook(book.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Book deleted.');
      onOpenChange(false);
      router.refresh();
    });
  }

  // Names tagged on this book that have no vocabulary row — legacy tags, or a
  // category deleted in another tab. Rendered so a book never silently loses
  // a tag just because the vocabulary moved on.
  const orphanCategories = state.categories.filter(
    (c) => !vocab.some((v) => v.name === c),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{book ? 'Edit book' : 'Add book'}</DialogTitle>
          <DialogDescription>
            {book ? 'Update the entry.' : 'Add a book to your reading queue.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Book</Label>
            <Input
              id="title"
              value={state.title}
              onChange={(e) => setState({ ...state, title: e.target.value })}
              placeholder="Title"
              disabled={pending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="author">Author</Label>
            <Input
              id="author"
              value={state.author ?? ''}
              onChange={(e) => setState({ ...state, author: e.target.value })}
              placeholder="Optional"
              disabled={pending}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Priority</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITY_ORDER.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setState({ ...state, priority: p })}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[12px] font-semibold ring-1 transition-colors',
                    state.priority === p
                      ? 'bg-accent text-accent-foreground ring-accent'
                      : 'bg-surface-2 text-text-2 ring-border hover:text-text',
                  )}
                  disabled={pending}
                >
                  {PRIORITY_LABEL[p as BookPriority]}
                </button>
              ))}
            </div>
            {state.priority === 'lido' && book?.priority !== 'lido' && (
              <p className="text-text-3 text-[11px]">
                {book ? 'The finish date will be set to today when you save.' : 'The finish date defaults to today. Set an earlier date for a book you already read.'}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Category</Label>
              <button
                type="button"
                onClick={() => setManaging((m) => !m)}
                className={cn(
                  'text-text-2 hover:text-text inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-medium transition-colors',
                  managing && 'text-text',
                )}
              >
                <Settings2 className="h-3 w-3" />
                Gerenciar
              </button>
            </div>

            {managing ? (
              <ManageBookCategories
                categories={vocab}
                counts={categoryCounts}
                onChanged={() => {
                  // A rename or delete rewrites book rows; refreshing re-runs
                  // the server component so the vocabulary AND this book's
                  // tags come back canonical instead of stale.
                  router.refresh();
                }}
                onClose={() => setManaging(false)}
              />
            ) : null}

            <div className="flex flex-wrap gap-1.5">
              {vocab.map((v) => (
                <CategoryChip
                  key={v.id}
                  category={v.name}
                  color={v.color}
                  onClick={() => toggleCategory(v.name)}
                  selected={state.categories.includes(v.name)}
                />
              ))}
              {orphanCategories.map((c) => (
                <CategoryChip
                  key={c}
                  category={c}
                  onClick={() => toggleCategory(c)}
                  selected
                />
              ))}
            </div>
            <div className="mt-1 flex gap-1.5">
              <Input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Nova categoria…"
                disabled={pending}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomCategory();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addCustomCategory}
                disabled={pending || !customCategory.trim()}
              >
                Add
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="why">Why?</Label>
            <textarea
              id="why"
              value={state.why ?? ''}
              onChange={(e) => setState({ ...state, why: e.target.value })}
              placeholder="Why is this worth reading?"
              disabled={pending}
              rows={3}
              className="bg-surface-2 border-border focus-visible:ring-accent rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="started">Started</Label>
              <Input
                id="started"
                type="date"
                value={state.started_at ?? ''}
                onChange={(e) =>
                  setState({ ...state, started_at: e.target.value || null })
                }
                disabled={pending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="finished">Finished</Label>
              {book?.finished_year && !state.finished_at && (
                <p className="text-text-3 text-[11px]">Read in {formatBookFinishedDate(book)}. Add an exact date if known.</p>
              )}
              <Input
                id="finished"
                type="date"
                value={state.finished_at ?? ''}
                onChange={(e) =>
                  setState({ ...state, finished_at: e.target.value || null })
                }
                disabled={pending || (book != null && book.priority !== 'lido' && state.priority === 'lido')}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <Label>Rating</Label>
              <span
                className={cn(
                  'text-[13px] font-semibold tabular-nums',
                  state.rating == null ? 'text-text-4' : 'text-accent',
                )}
              >
                {state.rating ?? '—'}
              </span>
            </div>
            <GradePicker
              value={state.rating}
              onChange={(rating) => setState({ ...state, rating })}
              disabled={pending}
            />
          </div>
        </div>

        <DialogFooter>
          {book ? (
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
            {pending ? 'Saving…' : book ? 'Save' : 'Add book'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
