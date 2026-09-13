'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { DefaultHabit } from '@/lib/seed';
import { saveHabits } from '../actions';
import { AreaChip } from '@/components/area-chip';

interface RowState extends DefaultHabit {
  _id: string; // local id
}

const AREA_LABEL: Record<DefaultHabit['area'], string> = {
  professional: 'Pro',
  health: 'Health',
  family: 'Family',
  marriage: 'Marriage',
  cross_cutting: 'Cross',
};

export function HabitsForm({ initialHabits }: { initialHabits: DefaultHabit[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<RowState[]>(() =>
    initialHabits.map((h, i) => ({ ...h, _id: `seed-${i}` })),
  );
  const [pending, start] = useTransition();

  const update = (id: string, patch: Partial<RowState>) =>
    setRows((rs) => rs.map((r) => (r._id === id ? { ...r, ...patch } : r)));

  const remove = (id: string) => setRows((rs) => rs.filter((r) => r._id !== id));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const habits = rows.map((r) => ({
            name: r.name,
            area: r.area,
            time_slot: r.time_slot,
            is_counter: r.is_counter,
            counter_target_value: r.counter_target_value,
            counter_unit: r.counter_unit,
            reminder_lead_minutes: r.reminder_lead_minutes,
            sort_order: r.sort_order,
          }));
          const result = await saveHabits(habits);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          router.push('/setup/workout');
        });
      }}
      className="space-y-4"
    >
      <div className="border-border divide-border divide-y rounded-md border">
        {rows.map((row) => (
          <div
            key={row._id}
            className="grid grid-cols-[110px_1fr_56px_auto] items-center gap-2 px-2 py-2"
          >
            <Input
              type="time"
              value={row.time_slot ?? ''}
              onChange={(e) => update(row._id, { time_slot: e.target.value || null })}
              className="h-8"
              aria-label="Time"
            />
            <Input
              value={row.name}
              onChange={(e) => update(row._id, { name: e.target.value })}
              className="h-8"
              aria-label="Name"
            />
            <AreaChip area={row.area} label={AREA_LABEL[row.area]} />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => remove(row._id)}
              className="h-8 px-2 text-xs"
            >
              ✕
            </Button>
          </div>
        ))}
      </div>
      <div className="pt-2">
        <Button type="submit" disabled={pending || rows.length === 0} className="w-full">
          {pending ? 'Saving…' : `Save ${rows.length} habits`}
        </Button>
      </div>
    </form>
  );
}
