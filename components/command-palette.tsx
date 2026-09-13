'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { BrainSearchResults } from '@/components/brain-search-results';
import { searchBrain } from '@/app/(app)/second-brain/actions';
import type { BrainSearchHit } from '@/lib/supabase/types';

/**
 * Global ⌘K / Ctrl+K command palette. Mounted once in the (app) layout.
 * Types-to-search across notes + book notes; Enter opens the full search page.
 * Desktop-oriented (no native mobile trigger) — mobile uses the search page.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<BrainSearchHit[]>([]);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K toggles the palette from anywhere. Reset query + hits on every
  // toggle so the palette opens fresh (and clears when closed this way).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQ('');
        setHits([]);
        setOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Focus the input shortly after opening (after the dialog mounts/animates).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // Debounced search. A blank query returns the most recent items.
  useEffect(() => {
    if (!open) return;
    const trimmed = q.trim();
    const handle = setTimeout(() => {
      startTransition(async () => {
        const res = await searchBrain(trimmed, []);
        if (res.ok) setHits(res.data);
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [q, open]);

  function submit() {
    const trimmed = q.trim();
    setOpen(false);
    router.push(
      trimmed ? `/second-brain/search?q=${encodeURIComponent(trimmed)}` : '/second-brain/search',
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQ('');
          setHits([]);
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-[10vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogTitle className="sr-only">Buscar no Second Brain</DialogTitle>

        <div className="border-border flex items-center gap-2 border-b px-4 py-3">
          <Search className="text-text-3 h-4 w-4 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            placeholder="Buscar notas, livros, tags…"
            className="text-text placeholder:text-text-3 flex-1 bg-transparent text-[14px] focus-visible:outline-none"
          />
          {pending ? (
            <Loader2 className="text-text-3 h-4 w-4 shrink-0 animate-spin" />
          ) : null}
        </div>

        <div className="max-h-[55vh] overflow-y-auto">
          {hits.length > 0 ? (
            <BrainSearchResults hits={hits} compact onNavigate={() => setOpen(false)} />
          ) : (
            <div className="text-text-3 px-4 py-6 text-center text-[12.5px]">
              {q.trim() ? 'Nada encontrado.' : 'Digite para buscar. Enter abre a busca completa.'}
            </div>
          )}
        </div>

        <div className="border-border text-text-3 flex justify-between border-t px-4 py-2 text-[11px]">
          <span>↵ busca completa</span>
          <span>esc fecha</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
