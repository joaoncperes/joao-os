'use client';

import { useMemo, useState } from 'react';
import { HeatmapGrid } from '@/components/ui/heatmap-grid';
import { StatCard } from '@/components/ui/stat-card';
import { AREA_COLOR } from '@/lib/area-color';
import { cn } from '@/lib/utils';
import type { Area } from '@/lib/supabase/types';

export interface HabitMeta {
  id: string;
  name: string;
  area: Area;
  archived: boolean;
  /** First day this habit existed, in the user's TZ. */
  startDate: string;
}

interface Props {
  days: string[];
  today: string;
  habits: HabitMeta[];
  /** Per day: habits completed (non-archived only). */
  allDone: number[];
  /** Per day: non-archived habits that existed. 0 = out of range. */
  allTotal: number[];
  /** habitId → '0'/'1' string, one char per day. */
  donePattern: Record<string, string>;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDay(dateISO: string): string {
  const [y, m, d] = dateISO.split('-');
  return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`;
}

function bucket(ratio: number): number {
  if (ratio <= 0) return 0;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

/**
 * Longest and current run of `true` over in-range days.
 * The current streak allows the final day (today) to be missing — habits get logged
 * through the evening, so a blank today shouldn't read as a broken streak.
 * Mirrors the journal/meditation streak idiom.
 */
function streaks(done: boolean[], inRange: boolean[]): { current: number; best: number } {
  let best = 0;
  let run = 0;
  for (let i = 0; i < done.length; i++) {
    if (!inRange[i]) {
      run = 0;
      continue;
    }
    run = done[i] ? run + 1 : 0;
    if (run > best) best = run;
  }

  let i = done.length - 1;
  if (i >= 0 && !done[i]) i -= 1; // today may still be pending
  let current = 0;
  for (; i >= 0 && inRange[i] && done[i]; i--) current++;

  return { current, best };
}

export function HabitHeatmapClient({
  days,
  today,
  habits,
  allDone,
  allTotal,
  donePattern,
}: Props) {
  const [selected, setSelected] = useState<string>('all');

  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);
  const habit = selected === 'all' ? null : habits.find((h) => h.id === selected) ?? null;

  const view = useMemo(() => {
    const levels: number[] = [];
    const tooltips: string[] = [];
    const done: boolean[] = [];
    const inRange: boolean[] = [];

    if (!habit) {
      for (let i = 0; i < days.length; i++) {
        const total = allTotal[i];
        const n = allDone[i];
        inRange.push(total > 0);
        done.push(n > 0);
        levels.push(total === 0 ? -1 : bucket(n / total));
        tooltips.push(
          total === 0
            ? `No habits yet · ${fmtDay(days[i])}`
            : `${n} of ${total} habits · ${fmtDay(days[i])}`,
        );
      }
    } else {
      const pattern = donePattern[habit.id] ?? '';
      for (let i = 0; i < days.length; i++) {
        const ok = days[i] >= habit.startDate;
        const isDone = pattern[i] === '1';
        inRange.push(ok);
        done.push(isDone);
        levels.push(!ok ? -1 : isDone ? 4 : 0);
        tooltips.push(
          !ok
            ? `Not tracked yet · ${fmtDay(days[i])}`
            : `${isDone ? 'Done' : 'Not done'} · ${habit.name} · ${fmtDay(days[i])}`,
        );
      }
    }

    // Totals over the whole window.
    let totalDone = 0;
    let totalSlots = 0;
    for (let i = 0; i < days.length; i++) {
      if (!inRange[i]) continue;
      if (habit) {
        totalDone += done[i] ? 1 : 0;
        totalSlots += 1;
      } else {
        totalDone += allDone[i];
        totalSlots += allTotal[i];
      }
    }

    // Last 30 days.
    let d30 = 0;
    let s30 = 0;
    for (let i = Math.max(0, days.length - 30); i < days.length; i++) {
      if (!inRange[i]) continue;
      if (habit) {
        d30 += done[i] ? 1 : 0;
        s30 += 1;
      } else {
        d30 += allDone[i];
        s30 += allTotal[i];
      }
    }
    const pct30 = s30 > 0 ? Math.round((d30 / s30) * 100) : 0;

    const { current, best } = streaks(done, inRange);

    return { levels, tooltips, totalDone, totalSlots, pct30, current, best };
  }, [days, allDone, allTotal, donePattern, habit]);

  const headline = habit
    ? `${view.totalDone} ${view.totalDone === 1 ? 'day' : 'days'} completed in the last year`
    : `${view.totalDone} habit-completions in the last year`;

  return (
    <div className="flex flex-col">
      {/* Habit selector */}
      <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
        <Chip label="All habits" selected={selected === 'all'} onClick={() => setSelected('all')} />
        {[...active, ...archived].map((h) => (
          <Chip
            key={h.id}
            label={h.name}
            area={h.area}
            muted={h.archived}
            selected={selected === h.id}
            onClick={() => setSelected(h.id)}
          />
        ))}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Last 30 days"
          value={view.pct30}
          unit="%"
          bar={{ pct: view.pct30, tone: 'success' }}
        />
        <StatCard
          label="Current streak"
          value={view.current}
          unit={view.current === 1 ? 'day' : 'days'}
        />
        <StatCard label="Best streak" value={view.best} unit="days" />
        <StatCard label="Total done" value={view.totalDone} />
      </div>

      <section className="bg-surface border-border rounded-xl border p-4 lg:p-5">
        <h2 className="text-text mb-4 text-[14px] font-semibold">{headline}</h2>
        <HeatmapGrid
          days={days}
          levels={view.levels}
          tooltips={view.tooltips}
          today={today}
          legend={habit ? 'binary' : 'scale'}
        />
      </section>

      <p className="text-text-3 mt-3 text-[12px]">
        {habit
          ? 'Green means the habit was completed that day.'
          : 'Darker means a bigger share of that day’s habits were done. Missed and frozen days read the same as untouched — the weekly grid keeps that detail.'}
      </p>
    </div>
  );
}

function Chip({
  label,
  area,
  selected,
  muted,
  onClick,
}: {
  label: string;
  area?: Area;
  selected: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors',
        selected
          ? 'border-accent bg-accent-soft text-accent'
          : 'border-border bg-surface text-text-2 hover:bg-surface-2 hover:text-text',
        muted && !selected && 'text-text-3',
      )}
    >
      {area ? (
        <span className={cn('h-[6px] w-[6px] shrink-0 rounded-full', AREA_COLOR[area].dot)} />
      ) : null}
      {label}
    </button>
  );
}
