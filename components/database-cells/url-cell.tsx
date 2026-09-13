'use client';

import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

const DEBOUNCE_MS = 600;

function hrefOf(v: string): string {
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

// Display = clickable link (open in new tab) + a pencil to edit. Editing is an
// inline url input with the same debounce as text cells. Prop-driven and shared
// by both table surfaces.
export function DbUrlCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  function schedule(next: string) {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onChange(next), DEBOUNCE_MS);
  }
  function flush(next: string) {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    onChange(next);
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="url"
        inputMode="url"
        value={draft}
        placeholder="https://…"
        onChange={(e) => {
          setDraft(e.target.value);
          schedule(e.target.value);
        }}
        onBlur={() => {
          flush(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            flush(draft);
            setEditing(false);
          }
          if (e.key === 'Escape') {
            if (timer.current) window.clearTimeout(timer.current);
            setDraft(value);
            setEditing(false);
          }
        }}
        className="text-text placeholder:text-text-4 w-full bg-transparent px-2.5 py-1.5 text-[13px] outline-none"
      />
    );
  }

  return (
    <div className="flex min-h-[34px] items-center gap-1.5 px-2.5 py-1.5">
      {value ? (
        <a
          href={hrefOf(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent truncate text-[13px] underline underline-offset-2"
        >
          {value.replace(/^https?:\/\//i, '')}
        </a>
      ) : null}
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        aria-label="Edit URL"
        className={cn('text-text-4 hover:text-text shrink-0', value ? '' : 'w-full text-left text-[13px]')}
      >
        {value ? <Pencil className="h-3 w-3" /> : '—'}
      </button>
    </div>
  );
}
