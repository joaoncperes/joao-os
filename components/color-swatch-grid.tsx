import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHIP_COLORS, swatchClass } from '@/lib/second-brain/column-display';
import type { ChipColor } from '@/lib/supabase/types';

// 10-color picker for a multi-select option. Selected swatch gets a ring.
export function ColorSwatchGrid({
  value,
  onChange,
}: {
  value: ChipColor;
  onChange: (color: ChipColor) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CHIP_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={c}
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-full transition-transform hover:scale-110',
            swatchClass(c),
            value === c ? 'ring-text ring-offset-surface ring-2 ring-offset-1' : '',
          )}
        >
          {value === c ? <Check className="h-3 w-3 text-white" /> : null}
        </button>
      ))}
    </div>
  );
}
