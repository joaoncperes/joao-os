'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { deriveTitleFromMd } from '../../../note-card';
import { useFolderTable } from './use-folder-table';
import type { FolderRowData } from './types';

const DEBOUNCE_MS = 600;

// The sticky first column. Click the title to rename inline (debounced
// updateNoteTitle); the arrow opens the note as a page.
export function NameCell({ row }: { row: FolderRowData }) {
  const router = useRouter();
  const { setTitle } = useFolderTable();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.title ?? '');
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const display = row.title?.trim() || deriveTitleFromMd(row.content_md) || '';

  function flush(next: string) {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setTitle(row.id, next);
  }

  return (
    <div className="flex min-h-[34px] items-center gap-1 px-2.5 py-1.5">
      {editing ? (
        <input
          autoFocus
          value={draft}
          placeholder="Untitled"
          onChange={(e) => {
            setDraft(e.target.value);
            if (timer.current) window.clearTimeout(timer.current);
            timer.current = window.setTimeout(
              () => setTitle(row.id, e.target.value),
              DEBOUNCE_MS,
            );
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
              setDraft(row.title ?? '');
              setEditing(false);
            }
          }}
          className="text-text w-full bg-transparent text-[13px] font-medium outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(row.title ?? '');
            setEditing(true);
          }}
          className="text-text flex-1 truncate text-left text-[13px] font-medium"
        >
          {display || <span className="text-text-4 font-normal">Untitled</span>}
        </button>
      )}
      <button
        type="button"
        onClick={() => router.push(`/second-brain/notes/${row.id}`)}
        aria-label="Open note"
        className="text-text-4 hover:text-accent shrink-0"
      >
        <ArrowUpRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
