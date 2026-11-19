'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { DefaultSplitDay } from '@/lib/seed';
import { finishSetup } from '../actions';

interface Props {
  initialSplit: DefaultSplitDay[];
  dayLabels: readonly string[];
}

export function WorkoutForm({ initialSplit, dayLabels }: Props) {
  const router = useRouter();
  const [split, setSplit] = useState<DefaultSplitDay[]>(initialSplit);
  const [pending, start] = useTransition();

  const updateName = (dow: number, name: string) =>
    setSplit((s) => s.map((d) => (d.day_of_week === dow ? { ...d, split_name: name } : d)));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await finishSetup({ split });
          if (result.error) {
            toast.error(result.error);
            return;
          }
          router.push('/metas');
        });
      }}
      className="space-y-3"
    >
      <div className="border-border divide-border divide-y rounded-md border">
        {split.map((day) => (
          <div key={day.day_of_week} className="grid grid-cols-[100px_1fr_auto] items-center gap-2 px-3 py-2">
            <span className="text-muted-foreground text-xs">{dayLabels[day.day_of_week]}</span>
            <Input
              value={day.split_name}
              onChange={(e) => updateName(day.day_of_week, e.target.value)}
              className="h-8"
              aria-label={`${dayLabels[day.day_of_week]} split name`}
            />
            <span className="text-muted-foreground text-xs">{day.exercises.length}ex</span>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Per-exercise edits live in Settings. Sprint 0 commits the default sets per João&apos;s
        spec.
      </p>
      <div className="pt-2">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Finishing setup…' : 'Save and finish setup'}
        </Button>
      </div>
    </form>
  );
}
