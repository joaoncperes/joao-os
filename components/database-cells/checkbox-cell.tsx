'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Instant on/off toggle. Checked = the string 'true'; unchecked clears the cell
// (key removed) so the "absent key = unchecked/empty" storage invariant holds.
// No debounce — a click writes immediately. Prop-driven and shared by both table
// surfaces.
export function DbCheckboxCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string | null) => void;
}) {
  const checked = value === 'true';
  return (
    <div className="flex min-h-[34px] items-center px-2.5 py-1.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(checked ? null : 'true')}
        className={cn(
          'flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition-colors',
          checked
            ? 'bg-accent border-accent text-bg'
            : 'border-border hover:border-text-4 bg-transparent',
        )}
      >
        {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </button>
    </div>
  );
}
