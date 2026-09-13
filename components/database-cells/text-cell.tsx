'use client';

import { useEffect, useRef, useState } from 'react';

const DEBOUNCE_MS = 600;

// Click-to-edit text cell. Local draft for instant typing; onChange is debounced
// while typing and flushed on blur/Enter. Prop-driven and shared by both table
// surfaces — the caller owns persistence (editor node attrs / folder server actions).
export function DbTextCell({
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
        value={draft}
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
        className="text-text w-full bg-transparent px-2.5 py-1.5 text-[13px] outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="text-text block min-h-[34px] w-full px-2.5 py-1.5 text-left text-[13px]"
    >
      {value ? <span className="line-clamp-2">{value}</span> : <span className="text-text-4">—</span>}
    </button>
  );
}
