'use client';

import { cn } from '@/lib/utils';

interface GradePickerProps {
  value: number | null;
  onChange: (next: number | null) => void;
  disabled?: boolean;
}

// Segmented 0–10 single-select grade ("nota"). Tap a number to set it; tap the
// selected number again to clear (null = ungraded). 0 is a real grade, visually
// distinct from "no grade". Sibling to <ScorePips> (which is 1–5 cumulative-fill
// for the Journal) — kept separate so neither component grows a mode flag.
export function GradePicker({ value, onChange, disabled }: GradePickerProps) {
  return (
    <div className="grid grid-cols-11 gap-1">
      {Array.from({ length: 11 }, (_, n) => {
        const selected = value === n;
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-label={`Rating ${n}`}
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : n)}
            className={cn(
              'h-9 rounded-md border text-[12.5px] font-semibold tabular-nums transition-[background,color,border-color,filter] duration-150',
              selected
                ? 'bg-accent border-accent text-white hover:brightness-95'
                : 'border-border bg-surface text-text-3 hover:bg-surface-2 hover:border-border-strong hover:text-text',
              disabled && 'opacity-50 pointer-events-none',
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
