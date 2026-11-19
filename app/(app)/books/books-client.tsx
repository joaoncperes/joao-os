'use client';

import { useMemo, useState, useDeferredValue, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PriorityChip } from '@/components/priority-chip';
import { CategoryChip } from '@/components/category-chip';
import { BookListRow } from '@/components/book-list-row';
import { BookFormDialog } from '@/components/book-form-dialog';
import { BookSearch } from '@/components/book-search';
import { BookReadingStats } from '@/components/book-reading-stats';
import { PRIORITY_LABEL, PRIORITY_ORDER } from '@/lib/books-display';
import type { BookCategoryData } from '@/lib/book-categories';
import type { Book, BookPriority } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

interface Props {
  initialBooks: Book[];
  loadError: string | null;
  initialPriority: string | null;
  initialCategory: string | null;
  initialQuery: string;
  initialMinGrade: number | null;
  initialSort: 'priority' | 'grade';
  categoryData: BookCategoryData;
  today: string;
}

function isPriority(value: string | null): value is BookPriority {
  return value != null && PRIORITY_ORDER.includes(value as BookPriority);
}

// Minimum-grade filter thresholds. Grades are 0–10; ≥0 would be a no-op, so the
// row starts at 1. "All" clears the filter.
const GRADE_THRESHOLDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const SORT_MODES = [
  { mode: 'priority', label: 'Prioridade' },
  { mode: 'grade', label: 'Nota' },
] as const;

export function BooksClient({
  initialBooks,
  loadError,
  initialPriority,
  initialCategory,
  initialQuery,
  initialMinGrade,
  initialSort,
  categoryData,
  today,
}: Props) {
  const router = useRouter();
  const books = initialBooks;
  const [priorityFilter, setPriorityFilter] = useState<BookPriority | null>(
    isPriority(initialPriority) ? initialPriority : null,
  );
  const [categoryFilter, setCategoryFilter] = useState<string | null>(
    initialCategory,
  );
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());
  const [minGrade, setMinGrade] = useState<number | null>(initialMinGrade);
  const [sortMode, setSortMode] = useState<'priority' | 'grade'>(initialSort);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Book | null>(null);

  // Sync URL with filters so the view is bookmarkable.
  useEffect(() => {
    const params = new URLSearchParams();
    if (priorityFilter) params.set('priority', priorityFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (minGrade != null) params.set('grade', String(minGrade));
    if (sortMode !== 'priority') params.set('sort', sortMode);
    const next = params.toString();
    const url = next ? `/books?${next}` : '/books';
    window.history.replaceState(null, '', url);
  }, [priorityFilter, categoryFilter, searchQuery, minGrade, sortMode]);

  const filtered = useMemo(() => {
    return books
      .filter((b) => (priorityFilter ? b.priority === priorityFilter : true))
      .filter((b) =>
        categoryFilter ? b.categories.includes(categoryFilter) : true,
      )
      .filter((b) =>
        minGrade == null ? true : b.rating != null && b.rating >= minGrade,
      )
      .filter((b) => {
        if (!deferredQuery) return true;
        const hay = `${b.title} ${b.author ?? ''} ${b.why ?? ''}`.toLowerCase();
        return hay.includes(deferredQuery);
      })
      .sort((a, b) => {
        const pi = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
        if (pi !== 0) return pi;
        const da = a.finished_at ?? '';
        const db = b.finished_at ?? '';
        if (da !== db) return db.localeCompare(da);
        return a.title.localeCompare(b.title);
      });
  }, [books, priorityFilter, categoryFilter, deferredQuery, minGrade]);

  const grouped = useMemo(() => {
    const buckets = new Map<BookPriority, Book[]>();
    for (const b of filtered) {
      const list = buckets.get(b.priority) ?? [];
      list.push(b);
      buckets.set(b.priority, list);
    }
    return PRIORITY_ORDER.flatMap((p) =>
      buckets.get(p)?.length ? [{ priority: p, books: buckets.get(p)! }] : [],
    );
  }, [filtered]);

  // Flat ranking for "Sort: Rating" — highest grade first, ungraded last,
  // tie-broken by most recently finished then title.
  const gradeSorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const ra = a.rating ?? -1;
      const rb = b.rating ?? -1;
      if (ra !== rb) return rb - ra;
      const da = a.finished_at ?? '';
      const db = b.finished_at ?? '';
      if (da !== db) return db.localeCompare(da);
      return a.title.localeCompare(b.title);
    });
  }, [filtered]);

  // Categories present across the user's books, for the filter row. Ordered by
  // the user's vocabulary (categoryColors is built in vocabulary order), with
  // any tag that has no vocabulary row trailing behind.
  const presentCategories = useMemo(() => {
    const set = new Set<string>();
    for (const b of books) for (const c of b.categories) set.add(c);
    const ordered = Object.keys(categoryData.colorMap).filter((c) => set.has(c));
    const extras = Array.from(set).filter((c) => !(c in categoryData.colorMap));
    return [...ordered, ...extras];
  }, [books, categoryData]);

  const total = books.length;
  const reading = books.filter((b) => b.priority === 'lendo').length;
  const pendingNotes = books.filter(
    (b) => b.priority === 'lido' && b.has_notes === false,
  ).length;

  const filtersOn =
    priorityFilter != null ||
    categoryFilter != null ||
    minGrade != null ||
    searchQuery.trim().length > 0;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-text-3 mb-1.5 text-[13px] font-medium uppercase tracking-[0.02em]">
            Biblioteca
          </div>
          <h1 className="text-text text-[30px] font-semibold leading-[1.1] tracking-[-0.02em]">
            Livros
          </h1>
          <p className="text-text-3 mt-2 text-[13px]">
            {total} {total === 1 ? 'livro' : 'livros'} na biblioteca · {reading} lendo agora
            {pendingNotes > 0 ? (
              <>
                {' · '}
                <span className="text-amber-700 font-semibold">
                  {pendingNotes} sem notas
                </span>
              </>
            ) : null}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditTarget(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Novo livro
        </Button>
      </header>

      {!loadError && <BookReadingStats books={books} today={today} />}

      <BookSearch />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-text-3 mr-1 text-[10.5px] font-semibold uppercase tracking-[0.06em]">
            Prioridade
          </span>
          <button
            type="button"
            onClick={() => setPriorityFilter(null)}
            className={cn(
              'rounded-md px-2.5 py-1 text-[12px] font-semibold ring-1 transition-colors',
              priorityFilter == null
                ? 'bg-accent text-accent-foreground ring-accent'
                : 'bg-surface-2 text-text-2 ring-border hover:text-text',
            )}
          >
            Todos
          </button>
          {PRIORITY_ORDER.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() =>
                setPriorityFilter((prev) => (prev === p ? null : p))
              }
            >
              <PriorityChip
                priority={p}
                className={cn(
                  'transition-opacity',
                  priorityFilter && priorityFilter !== p && 'opacity-40',
                )}
              />
              <span className="sr-only">Filtrar por {PRIORITY_LABEL[p]}</span>
            </button>
          ))}
        </div>

        {presentCategories.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-text-3 mr-1 text-[10.5px] font-semibold uppercase tracking-[0.06em]">
              Categoria
            </span>
            <button
              type="button"
              onClick={() => setCategoryFilter(null)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[12px] font-semibold ring-1 transition-colors',
                categoryFilter == null
                  ? 'bg-accent text-accent-foreground ring-accent'
                  : 'bg-surface-2 text-text-2 ring-border hover:text-text',
              )}
            >
              Todos
            </button>
            {presentCategories.map((c) => (
              <CategoryChip
                key={c}
                category={c}
                color={categoryData.colorMap[c]}
                onClick={() =>
                  setCategoryFilter((prev) => (prev === c ? null : c))
                }
                selected={categoryFilter == null || categoryFilter === c}
              />
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-text-3 mr-1 text-[10.5px] font-semibold uppercase tracking-[0.06em]">
            Nota mínima
          </span>
          <button
            type="button"
            onClick={() => setMinGrade(null)}
            className={cn(
              'rounded-md px-2.5 py-1 text-[12px] font-semibold ring-1 transition-colors',
              minGrade == null
                ? 'bg-accent text-accent-foreground ring-accent'
                : 'bg-surface-2 text-text-2 ring-border hover:text-text',
            )}
          >
            Todos
          </button>
          {GRADE_THRESHOLDS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setMinGrade((prev) => (prev === n ? null : n))}
              className={cn(
                'rounded-md px-2.5 py-1 text-[12px] font-semibold tabular-nums ring-1 transition-colors',
                minGrade === n
                  ? 'bg-accent text-accent-foreground ring-accent'
                  : 'bg-surface-2 text-text-2 ring-border hover:text-text',
              )}
            >
              ≥{n}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="text-text-3 absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            placeholder="Filtrar por título, autor ou 'por que'…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-text-3 hover:text-text absolute right-3 top-1/2 -translate-y-1/2"
              aria-label="Limpar filtro"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-text-3 mr-1 text-[10.5px] font-semibold uppercase tracking-[0.06em]">
            Ordenar
          </span>
          {SORT_MODES.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSortMode(mode)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[12px] font-semibold ring-1 transition-colors',
                sortMode === mode
                  ? 'bg-accent text-accent-foreground ring-accent'
                  : 'bg-surface-2 text-text-2 ring-border hover:text-text',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loadError ? (
        <div className="bg-surface border-border text-destructive rounded-xl border p-4 text-sm">
          {loadError}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface border-border text-text-3 rounded-xl border px-5 py-10 text-center text-[13px]">
          {filtersOn ? 'Nenhum livro com esses filtros.' : 'Nenhum livro ainda — toque em Novo livro para adicionar.'}
        </div>
      ) : sortMode === 'grade' ? (
        <ul className="flex flex-col gap-2">
          {gradeSorted.map((book) => (
            <BookListRow
              key={book.id}
              book={book}
              onEdit={(b) => {
                setEditTarget(b);
                setFormOpen(true);
              }}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-7">
          {grouped.map(({ priority, books: list }) => (
            <section key={priority} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-text text-[14px] font-semibold tracking-[-0.005em]">
                  {PRIORITY_LABEL[priority]}
                  <span className="text-text-3 ml-2 text-[12px] font-normal">
                    {list.length}
                  </span>
                </h2>
              </div>
              <ul className="flex flex-col gap-2">
                {list.map((book) => (
                  <BookListRow
                    key={book.id}
                    book={book}
                    categoryColors={categoryData.colorMap}
                    onEdit={(b) => {
                      setEditTarget(b);
                      setFormOpen(true);
                    }}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <BookFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        book={editTarget}
        categories={categoryData.categories}
        categoryCounts={categoryData.counts}
        onSaved={(id) => {
          if (!editTarget) router.push(`/books/${id}`);
        }}
      />
    </div>
  );
}
