import { PenSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  size?: 'sm' | 'md';
  className?: string;
}

// Amber, low-key warning. Reserved for `Read` books that don't have any
// notes yet — Pedro's rule: a book is only "really read" once it has notes.
export function PendingNotesChip({ size = 'md', className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md font-semibold tracking-tight whitespace-nowrap',
        'bg-amber-100 text-amber-900 ring-1 ring-amber-200',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10.5px]' : 'px-2 py-0.5 text-[12px]',
        className,
      )}
      title="This book is marked as Read but has no notes yet."
    >
      <PenSquare className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      Pending notes
    </span>
  );
}
