import { cn } from '@/lib/utils';
import { categoryChipClass } from '@/lib/books-display';
import { chipClass } from '@/lib/second-brain/column-display';
import type { ChipColor } from '@/lib/supabase/types';

interface Props {
  category: string;
  /** Palette key from the user's vocabulary. Omit for names with no
   *  book_categories row (legacy tags) — those fall back to the static map. */
  color?: ChipColor | null;
  size?: 'sm' | 'md';
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}

export function CategoryChip({
  category,
  color,
  size = 'md',
  className,
  onClick,
  selected,
}: Props) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-md font-medium tracking-tight whitespace-nowrap transition-opacity',
        color ? chipClass(color) : categoryChipClass(category),
        size === 'sm' ? 'px-1.5 py-0.5 text-[10.5px]' : 'px-2 py-0.5 text-[12px]',
        onClick && 'cursor-pointer hover:opacity-90 active:opacity-75',
        onClick && selected === false && 'opacity-40 hover:opacity-65',
        className,
      )}
    >
      {category}
    </Tag>
  );
}
