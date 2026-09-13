'use client';

import { Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved';

interface SaveBarProps {
  status: SaveStatus;
  onSave: () => void;
  saveLabel?: string;
}

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: 'No changes yet',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved just now',
};

export function SaveBar({ status, onSave, saveLabel = 'Save' }: SaveBarProps) {
  const disabled = status !== 'dirty';
  return (
    <div
      className="bg-surface border-border sticky bottom-4 mt-5 flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
      style={{ boxShadow: 'var(--shadow-lg)' }}
    >
      <div className="text-text-3 flex items-center gap-2 text-[13px]">
        {status === 'saving' ? (
          <Loader2 className="text-accent h-3.5 w-3.5 animate-spin" />
        ) : (
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              status === 'idle' && 'bg-text-4',
              status === 'dirty' && 'bg-[oklch(70%_0.13_70)]',
              status === 'saved' && 'bg-success',
            )}
          />
        )}
        <span>{STATUS_TEXT[status]}</span>
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className={cn(
          'bg-accent inline-flex items-center gap-2 rounded-lg px-5 py-2 text-[13.5px] font-semibold text-white transition-[filter,transform] duration-100',
          'hover:brightness-95 active:translate-y-px disabled:cursor-default disabled:opacity-50',
        )}
      >
        {status === 'saved' ? <Check className="h-3.5 w-3.5" /> : null}
        {saveLabel}
      </button>
    </div>
  );
}
