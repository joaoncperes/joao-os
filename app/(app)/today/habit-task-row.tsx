'use client';

import { useState } from 'react';
import { HabitRecoveryIndicator } from './habit-recovery-indicator';
import { Check, GripVertical, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTimeSlot } from '@/lib/date';
import type { ComponentPropsWithoutRef } from 'react';

interface BaseProps {
  kind: 'habit' | 'task';
  recoveryNeeded?: boolean;
  done: boolean;
  time: string | null;
  title: string;
  disabled?: boolean;
  onToggle: (nowComplete: boolean) => void;
  onDelete?: () => void;
  // Drag handle props (only for tasks).
  dragHandleProps?: ComponentPropsWithoutRef<'button'>;
  isDragging?: boolean;
  // Visual dim when an upstream anchor in the chain was missed. The row is
  // still actionable; we only soften the surface to flag the broken chain.
  dimmed?: boolean;
  // When provided, the time cell becomes editable (tasks only). Habits set their
  // time on the habit record itself, so they pass nothing and stay read-only.
  onTimeChange?: (next: string | null) => void;
}

export function HabitTaskRow({
  kind,
  recoveryNeeded = false,
  done,
  time,
  title,
  disabled,
  onToggle,
  onDelete,
  dragHandleProps,
  isDragging,
  dimmed,
  onTimeChange,
}: BaseProps) {
  const [editingTime, setEditingTime] = useState(false);

  function commitTime(next: string) {
    setEditingTime(false);
    const cleaned = next.trim();
    const current = time?.slice(0, 5) ?? '';
    if (cleaned === current) return;
    onTimeChange?.(cleaned === '' ? null : cleaned);
  }

  return (
    <div
      className={cn(
        'group border-border hover:bg-surface-2 relative flex h-[42px] items-center gap-2.5 border-t px-3.5 transition-colors first:border-t-0',
        isDragging && 'opacity-40',
        dimmed && !done && 'opacity-60',
      )}
    >
      {dragHandleProps ? (
        <button
          type="button"
          aria-label="Drag"
          className="text-text-4 -ml-1 grid w-3 cursor-grab place-items-center opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing touch-none"
          {...dragHandleProps}
        >
          <GripVertical className="h-2.5 w-2.5" />
        </button>
      ) : (
        <span className="w-3 shrink-0" aria-hidden />
      )}
      <button
        type="button"
        aria-label={done ? 'Uncheck' : 'Check'}
        aria-pressed={done}
        disabled={disabled}
        onClick={() => onToggle(!done)}
        className={cn(
          'grid h-4 w-4 shrink-0 place-items-center rounded border-[1.5px] transition-[background-color,border-color,color] duration-150',
          done
            ? 'bg-accent border-accent text-white'
            : 'border-border-strong bg-surface text-transparent hover:border-accent',
        )}
      >
        {done ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : null}
      </button>
      {editingTime ? (
        // Native time input: gets the proper wheel picker on iOS without us
        // shipping a custom one, which matters since this runs as a PWA.
        <input
          type="time"
          autoFocus
          defaultValue={time?.slice(0, 5) ?? ''}
          disabled={disabled}
          onBlur={(e) => commitTime(e.target.value)}
          onChange={(e) => commitTime(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitTime(e.currentTarget.value);
            if (e.key === 'Escape') setEditingTime(false);
          }}
          className="text-text border-border-strong bg-surface w-[42px] shrink-0 rounded border px-0.5 text-xs font-medium tabular-nums outline-none"
        />
      ) : onTimeChange ? (
        <button
          type="button"
          aria-label={time ? `Change time (${formatTimeSlot(time)})` : 'Set time'}
          disabled={disabled}
          onClick={() => setEditingTime(true)}
          className={cn(
            'w-[42px] shrink-0 rounded text-left text-xs font-medium tabular-nums transition-colors',
            time ? 'text-text-3' : 'text-text-4 opacity-0 group-hover:opacity-100',
            done && 'text-text-4',
            !disabled && 'hover:text-accent',
          )}
        >
          {time ? formatTimeSlot(time) : '—'}
        </button>
      ) : (
        <span
          className={cn(
            'text-text-3 w-[42px] shrink-0 text-xs font-medium tabular-nums',
            !time && 'invisible',
            done && 'text-text-4',
          )}
        >
          {time ? formatTimeSlot(time) : '—'}
        </span>
      )}
      <span
        title={title}
        className={cn(
          'text-text min-w-0 flex-1 truncate text-[14px] font-medium',
          done && 'text-text-4 line-through decoration-[var(--text-4)]',
        )}
      >
        {title}
      </span>
      {kind === 'habit' && recoveryNeeded && !done ? (
        <HabitRecoveryIndicator title={title} />
      ) : null}
      {kind === 'habit' ? (
        <span className="text-text-3 bg-surface-2 inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] opacity-0 transition-opacity group-hover:opacity-100">
          Habit
        </span>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          aria-label="Delete"
          disabled={disabled}
          onClick={onDelete}
          className="text-text-4 hover:bg-danger-soft hover:text-danger grid h-[22px] w-[22px] shrink-0 place-items-center rounded opacity-0 transition-[opacity,background-color,color] group-hover:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}
