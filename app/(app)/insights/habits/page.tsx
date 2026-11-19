import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { todayInTz, addDays, sundayWeekStart, dateInTz } from '@/lib/date';
import { SectionHeader } from '@/components/ui/section-header';
import { HabitHeatmapClient, type HabitMeta } from './heatmap-client';
import type { Area } from '@/lib/supabase/types';

export const metadata = { title: 'Habit year — João OS' };
export const dynamic = 'force-dynamic';

const WEEKS = 53;

interface HabitRow {
  id: string;
  name: string;
  area: Area;
  archived: boolean;
  sort_order: number | null;
  created_at: string;
}

export default async function HabitYearPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: u } = await supabase
    .from('users')
    .select('time_zone')
    .eq('id', user.id)
    .maybeSingle();
  const tz = u?.time_zone ?? 'America/Sao_Paulo';
  const today = todayInTz(tz);

  // Sunday-anchored 53-week window ending on the week that contains today.
  const gridStart = addDays(sundayWeekStart(today), -(WEEKS - 1) * 7);
  const days: string[] = [];
  for (let d = gridStart; d <= today; d = addDays(d, 1)) days.push(d);

  // Archived habits stay selectable individually, but are excluded from the "All" ratio.
  const { data: habitData } = await supabase
    .from('habits')
    .select('id, name, area, archived, sort_order, created_at')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
    .returns<HabitRow[]>();
  const habits = habitData ?? [];

  // Done-only: miss and freeze render the same as an untouched day here.
  // .range() is required — PostgREST silently caps at 1000 rows otherwise.
  const { data: logData } = await supabase
    .from('habit_logs')
    .select('habit_id, log_date')
    .eq('user_id', user.id)
    .gte('log_date', gridStart)
    .lte('log_date', today)
    .not('completed_at', 'is', null)
    .range(0, 49_999)
    .returns<{ habit_id: string; log_date: string }[]>();
  const logs = logData ?? [];

  const dayIndex = new Map(days.map((d, i) => [d, i]));

  // Per-habit done pattern: one 0/1 per day in `days`.
  const patterns = new Map<string, Uint8Array>();
  for (const h of habits) patterns.set(h.id, new Uint8Array(days.length));
  const firstLog = new Map<string, string>();

  for (const l of logs) {
    const i = dayIndex.get(l.log_date);
    const p = patterns.get(l.habit_id);
    if (i === undefined || !p) continue;
    p[i] = 1;
    const prev = firstLog.get(l.habit_id);
    if (!prev || l.log_date < prev) firstLog.set(l.habit_id, l.log_date);
  }

  // A habit counts from the day it was created — or from its first log, whichever is
  // earlier. Seeded/backfilled habits can carry logs that predate created_at, and
  // without this the numerator would count days the denominator ignored (ratio > 1).
  const meta: HabitMeta[] = habits.map((h) => {
    const created = dateInTz(h.created_at, tz);
    const first = firstLog.get(h.id);
    return {
      id: h.id,
      name: h.name,
      area: h.area,
      archived: h.archived,
      startDate: first && first < created ? first : created,
    };
  });

  // Denominator: non-archived habits that already existed on that day.
  const starts = meta.filter((m) => !m.archived).map((m) => m.startDate);
  const allTotal = days.map((d) => starts.reduce((n, s) => n + (s <= d ? 1 : 0), 0));

  // Numerator: same roster, gated by the same start date.
  const allDone = new Array<number>(days.length).fill(0);
  for (const m of meta) {
    if (m.archived) continue;
    const p = patterns.get(m.id);
    if (!p) continue;
    for (let i = 0; i < days.length; i++) {
      if (p[i] && days[i] >= m.startDate) allDone[i] += 1;
    }
  }

  const donePattern: Record<string, string> = {};
  for (const [id, p] of patterns) donePattern[id] = Array.from(p).join('');

  return (
    <div className="flex flex-col">
      <SectionHeader
        eyebrow="Habit Tracking · Year"
        title="Habit year"
        subtitle="Every day of the last 53 weeks. Pick a habit to see it on its own."
        action={
          <Link
            href="/insights"
            className="bg-surface border-border text-text-2 hover:bg-surface-2 hover:text-text inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Weekly grid
          </Link>
        }
      />

      <HabitHeatmapClient
        days={days}
        today={today}
        habits={meta}
        allDone={allDone}
        allTotal={allTotal}
        donePattern={donePattern}
      />
    </div>
  );
}
