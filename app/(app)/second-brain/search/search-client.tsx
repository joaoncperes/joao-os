'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { ArrowLeft, Loader2, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { TagChip } from '@/components/tag-chip';
import { BrainSearchResults } from '@/components/brain-search-results';
import { searchBrain } from '../actions';
import type { BrainSearchHit } from '@/lib/supabase/types';

interface Props {
  initialQ: string;
  initialActiveTags: string[];
  allTags: { tag: string; count: number }[];
}

const MAX_VISIBLE_TAGS = 18;

export function SearchClient({ initialQ, initialActiveTags, allTags }: Props) {
  const [q, setQ] = useState(initialQ);
  const [activeTags, setActiveTags] = useState<string[]>(initialActiveTags);
  const [hits, setHits] = useState<BrainSearchHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [pending, startTransition] = useTransition();
  const [showAllTags, setShowAllTags] = useState(false);

  const trimmed = q.trim();
  const hasCriteria = trimmed.length >= 2 || activeTags.length > 0;

  // Debounced search whenever the query or the active tags change. When there
  // are no criteria we simply stop searching; stale hits stay in state but the
  // render hides them (the "no criteria" branch takes precedence below).
  useEffect(() => {
    if (!hasCriteria) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        const res = await searchBrain(trimmed, activeTags);
        if (res.ok) {
          setHits(res.data);
          setSearched(true);
        }
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [trimmed, activeTags, hasCriteria]);

  // Keep the URL in sync so searches are shareable / deep-linkable.
  useEffect(() => {
    const params = new URLSearchParams();
    if (trimmed) params.set('q', trimmed);
    if (activeTags.length) params.set('tags', activeTags.join(','));
    const qs = params.toString();
    window.history.replaceState(
      null,
      '',
      qs ? `/second-brain/search?${qs}` : '/second-brain/search',
    );
  }, [trimmed, activeTags]);

  function toggleTag(tag: string) {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  const visible = showAllTags ? allTags : allTags.slice(0, MAX_VISIBLE_TAGS);
  const visibleNames = new Set(visible.map((t) => t.tag));
  // Always surface active tags even if they fall outside the top slice.
  const extraActive = activeTags.filter((t) => !visibleNames.has(t));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/second-brain"
          className="text-text-3 hover:text-text flex w-fit items-center gap-1 text-[12px] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Second Brain
        </Link>
        <h1 className="text-text text-[24px] font-semibold tracking-[-0.015em]">
          Buscar
        </h1>
      </header>

      <div className="relative">
        <Search className="text-text-3 absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
        <Input
          placeholder="Buscar em todas as anotações…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
          className="pl-9 pr-9"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {pending ? (
            <Loader2 className="text-text-3 h-3.5 w-3.5 animate-spin" />
          ) : q ? (
            <button
              type="button"
              onClick={() => setQ('')}
              className="text-text-3 hover:text-text"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {allTags.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="text-text-3 text-[11px] font-medium uppercase tracking-[0.04em]">
            Filtrar por tag
          </div>
          <div className="flex flex-wrap gap-1.5">
            {extraActive.map((t) => (
              <TagChip key={t} tag={t} size="sm" selected onClick={() => toggleTag(t)} />
            ))}
            {visible.map(({ tag }) => (
              <TagChip
                key={tag}
                tag={tag}
                size="sm"
                selected={activeTags.includes(tag)}
                onClick={() => toggleTag(tag)}
              />
            ))}
            {!showAllTags && allTags.length > MAX_VISIBLE_TAGS ? (
              <button
                type="button"
                onClick={() => setShowAllTags(true)}
                className="text-text-3 hover:text-text px-1.5 py-0.5 text-[11px] font-medium"
              >
                +{allTags.length - MAX_VISIBLE_TAGS}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!hasCriteria ? (
        <div className="bg-surface border-border text-text-3 rounded-2xl border px-5 py-10 text-center text-[13px]">
          Digite ao menos 2 letras ou escolha uma tag para buscar.
        </div>
      ) : searched && hits.length === 0 && !pending ? (
        <div className="bg-surface border-border text-text-3 rounded-2xl border px-5 py-10 text-center text-[13px]">
          Nada encontrado.
        </div>
      ) : hits.length > 0 ? (
        <div className="bg-surface border-border overflow-hidden rounded-2xl border">
          <BrainSearchResults hits={hits} />
        </div>
      ) : null}
    </div>
  );
}
