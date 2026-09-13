'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { formatTimeSlot } from '@/lib/date';
import type { TodayHabit } from '@/lib/supabase/types';

const AREA_DOT: Record<TodayHabit['area'], string> = {
  professional: 'bg-[var(--area-professional)]',
  health: 'bg-[var(--area-health)]',
  family: 'bg-[var(--area-family)]',
  marriage: 'bg-[var(--area-marriage)]',
  cross_cutting: 'bg-[var(--area-cross)]',
};

interface Props {
  habit: TodayHabit;
  onToggle: (nowComplete: boolean) => void;
  disabled?: boolean;
}

export function HabitRow({ habit, onToggle, disabled }: Props) {
  const completed = habit.completed_at != null;
  return (
    <label className="flex cursor-pointer items-center gap-3 px-4 py-3 active:opacity-70">
      <Checkbox
        checked={completed}
        disabled={disabled}
        onCheckedChange={(v) => onToggle(Boolean(v))}
      />
      <span className={cn('h-2 w-2 shrink-0 rounded-full', AREA_DOT[habit.area])} aria-hidden />
      <span className="text-muted-foreground w-12 shrink-0 text-xs tabular-nums">
        {formatTimeSlot(habit.time_slot)}
      </span>
      <span
        className={cn(
          'flex-1 text-sm',
          completed && 'text-muted-foreground line-through',
        )}
      >
        {habit.name}
      </span>
    </label>
  );
}
