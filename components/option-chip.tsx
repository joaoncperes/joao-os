import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { chipClass } from '@/lib/second-brain/column-display';

// A colored multi-select option pill. Mirrors category-chip.tsx but takes an
// explicit palette color (not a #tag). Used in cells and the option picker.
export function OptionChip({
  label,
  color,
  size = 'md',
  onRemove,
  className,
}: {
  label: string;
  color: string;
  size?: 'sm' | 'md';
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md font-medium tracking-tight whitespace-nowrap',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-[3px] text-[12px]',
        chipClass(color),
        className,
      )}
    >
      <span className="truncate">{label}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="-mr-0.5 shrink-0 rounded hover:bg-black/10"
          aria-label={`Remover ${label}`}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}
