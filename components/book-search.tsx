'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import Link from 'next/link';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { searchBookNotes, type SearchHit } from '@/app/(app)/books/actions';
import { cn } from '@/lib/utils';

export function BookSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const showResults = open && trimmed.length >= 2;

  useEffect(() => {
    if (trimmed.length < 2) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        const res = await searchBookNotes(trimmed);
        if (res.ok) {
          setResults(res.data);
          setOpen(true);
        }
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [trimmed]);

  // Click-outside to dismiss.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Search className="text-text-3 absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
      <Input
        placeholder="Search across all book notes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        className="pl-9 pr-9"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        {pending ? (
          <Loader2 className="text-text-3 h-3.5 w-3.5 animate-spin" />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
              setOpen(false);
            }}
            className="text-text-3 hover:text-text"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {showResults && results.length > 0 ? (
        <div
          className={cn(
            'bg-surface border-border absolute left-0 right-0 top-full z-20 mt-1.5 max-h-[400px] overflow-y-auto rounded-xl border shadow-xl',
          )}
        >
          <ul className="flex flex-col">
            {results.map((hit) => (
              <li key={hit.book_id} className="border-border border-b last:border-b-0">
                <Link
                  href={`/books/${hit.book_id}`}
                  className="hover:bg-surface-2 block px-4 py-3 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <div className="text-text text-[13.5px] font-semibold leading-tight">
                    {hit.title}
                  </div>
                  <div
                    className="text-text-2 mt-1 text-[12px] leading-relaxed [&_mark]:bg-accent/30 [&_mark]:text-text [&_mark]:rounded-sm [&_mark]:px-0.5"
                    dangerouslySetInnerHTML={{ __html: hit.snippet }}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : showResults && !pending ? (
        <div className="bg-surface border-border text-text-3 absolute left-0 right-0 top-full z-20 mt-1.5 rounded-xl border px-4 py-3 text-sm shadow-xl">
          No matches in any book&apos;s notes.
        </div>
      ) : null}
    </div>
  );
}
