import { cn } from '@/lib/utils';
import {
  PRIORITY_CHIP,
  PRIORITY_LABEL,
} from '@/lib/books-display';
import type { BookPriority } from '@/lib/supabase/types';

interface Props {
  priority: BookPriority;
  size?: 'sm' | 'md';
  className?: string;
}

export function PriorityChip({ priority, size = 'md', className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md font-semibold tracking-tight whitespace-nowrap',
        PRIORITY_CHIP[priority],
        size === 'sm' ? 'px-1.5 py-0.5 text-[10.5px]' : 'px-2 py-0.5 text-[12px]',
        className,
      )}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
