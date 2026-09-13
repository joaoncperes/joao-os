import { cn } from '@/lib/utils';

interface Props {
  value: number;
  size?: 'sm' | 'md';
  className?: string;
}

// Book grade ("nota", 0–10) badge. Mirrors <PriorityChip>'s shape with an
// accent-soft tint so a graded book reads at a glance in the list.
export function GradeChip({ value, size = 'md', className }: Props) {
  return (
    <span
      className={cn(
        'bg-accent-soft text-accent ring-accent/20 inline-flex items-center whitespace-nowrap rounded-md font-semibold tabular-nums tracking-tight ring-1',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10.5px]' : 'px-2 py-0.5 text-[12px]',
        className,
      )}
    >
      Rating {value}
    </span>
  );
}
