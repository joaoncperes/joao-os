import { Check, X, Snowflake, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type GlyphState = 'done' | 'miss' | 'freeze' | 'empty' | 'future';

interface GlyphCellProps {
  state: GlyphState;
  today?: boolean;
  size?: number;
  className?: string;
}

const STATE_STYLES: Record<GlyphState, string> = {
  done: 'bg-success-soft text-success border-[oklch(85%_0.08_150)]',
  miss: 'bg-danger-soft text-danger border-[oklch(85%_0.06_25)]',
  freeze: 'bg-freeze-soft text-freeze border-[oklch(85%_0.08_70)]',
  empty: 'bg-surface text-text-4 border-border',
  future: 'bg-surface-2 text-text-4 border-border border-dashed opacity-60',
};

export function GlyphCell({ state, today, size = 30, className }: GlyphCellProps) {
  const Icon = state === 'done' ? Check : state === 'miss' ? X : state === 'freeze' ? Snowflake : Minus;
  const iconSize = Math.round(size * 0.46);
  return (
    <div
      className={cn(
        'mx-auto grid place-items-center rounded-md border transition-transform duration-150 hover:scale-[1.08]',
        STATE_STYLES[state],
        today && 'shadow-[0_0_0_2px_var(--accent)]',
        className,
      )}
      style={{ width: size, height: size }}
      aria-label={state}
    >
      <Icon style={{ width: iconSize, height: iconSize, strokeWidth: state === 'done' ? 3 : 2 }} />
    </div>
  );
}
