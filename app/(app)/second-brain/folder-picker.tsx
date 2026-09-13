'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Inbox } from 'lucide-react';
import { PARA_CATEGORY_LABEL, PARA_CATEGORY_ORDER } from '@/lib/second-brain/display';
import type { Folder, ParaCategory } from '@/lib/supabase/types';
import { cn } from '@/lib/utils';

interface Props {
  folders: Folder[];
  value: string | null; // current folder_id, null = Inbox
  onChange: (folderId: string | null) => void;
  disabled?: boolean;
  label?: string;
  /** When false, the "Inbox" option is hidden. Default true. */
  allowInbox?: boolean;
  align?: 'left' | 'right';
}

export function FolderPicker({
  folders,
  value,
  onChange,
  disabled,
  label = 'Mover para…',
  allowInbox = true,
  align = 'left',
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const current = value ? folders.find((f) => f.id === value) ?? null : null;
  const currentLabel = current ? current.title : 'Inbox';

  const grouped: Record<ParaCategory, Folder[]> = {
    projects: [],
    areas: [],
    resources: [],
    archive: [],
  };
  for (const f of folders) grouped[f.para_category].push(f);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="border-border hover:border-accent hover:bg-surface-2 text-text-2 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] font-medium transition-colors disabled:opacity-40"
      >
        <span className="text-text-3">{label}</span>
        <span className="text-text">{currentLabel}</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      {open ? (
        <div
          className={cn(
            'bg-surface border-border absolute z-20 mt-1 max-h-[320px] w-64 overflow-y-auto rounded-xl border p-1 shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {allowInbox ? (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px]',
                value === null
                  ? 'bg-accent-soft text-accent'
                  : 'text-text hover:bg-surface-2',
              )}
            >
              <Inbox className="h-3.5 w-3.5" />
              Inbox
            </button>
          ) : null}
          {PARA_CATEGORY_ORDER.map((cat) => {
            const list = grouped[cat];
            if (list.length === 0) return null;
            return (
              <div key={cat} className="mt-1">
                <div className="text-text-3 px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
                  {PARA_CATEGORY_LABEL[cat]}
                </div>
                {list.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      onChange(f.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px]',
                      value === f.id
                        ? 'bg-accent-soft text-accent'
                        : 'text-text hover:bg-surface-2',
                    )}
                  >
                    {f.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
