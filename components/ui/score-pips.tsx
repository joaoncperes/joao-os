'use client';

import { cn } from '@/lib/utils';

interface ScorePipsProps {
  label: string;
  value: number | null;
  onChange: (next: number | null) => void;
  max?: number;
  disabled?: boolean;
}

export function ScorePips({ label, value, onChange, max = 5, disabled }: ScorePipsProps) {
  const pips = Array.from({ length: max }, (_, i) => i + 1);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-text-2 text-xs font-semibold tracking-[0.02em]">{label}</span>
        <span
          className={cn(
            'text-[13px] font-semibold tabular-nums',
            value == null ? 'text-text-4' : 'text-accent',
          )}
        >
          {value ?? '—'}
        </span>
      </div>
      <div className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${max}, 1fr)` }}>
        {pips.map((n) => {
          const filled = value != null && n <= value;
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              aria-label={`Score ${n}`}
              aria-pressed={filled}
              onClick={() => onChange(value === n ? null : n)}
              className={cn(
                'h-9 rounded-md border text-[13px] font-semibold tabular-nums transition-[background,color,border-color,filter] duration-150',
                filled
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
    </div>
  );
}
