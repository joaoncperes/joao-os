import { createClient } from '@/lib/supabase/server';
import { todayInTz, sundayWeekStart, addDays } from '@/lib/date';
import type { WeeklyHabitSummary, Area } from '@/lib/supabase/types';
import { WeekClient, type HabitContextRow, type PriorityRow } from './week-client';

export const metadata = { title: 'Week — Pedro OS' };

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
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

  const ref = week ?? todayInTz(tz);
  const weekStart = sundayWeekStart(ref); // Sunday
  const weekEnd = addDays(weekStart, 6); // Saturday
  const lastWeekStart = addDays(weekStart, -7);

  const [planRes, lastPlanRes, habitsRes, lastWeekSummaryRes] = await Promise.all([
    supabase
      .from('weekly_plans')
      .select('id, reflection, prep_checklist')
      .eq('user_id', user.id)
      .eq('week_start_date', weekStart)
      .maybeSingle(),
    supabase
      .from('weekly_plans')
      .select('id')
      .eq('user_id', user.id)
      .eq('week_start_date', lastWeekStart)
      .maybeSingle(),
    supabase
      .from('habits')
      .select('id, name, area, sort_order')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('v_weekly_habit_summary')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start', lastWeekStart),
  ]);

  const [currentPrioritiesRes, lastPrioritiesRes] = await Promise.all([
    planRes.data
      ? supabase
          .from('weekly_priorities')
          .select('id, position, text')
          .eq('weekly_plan_id', planRes.data.id)
          .order('position', { ascending: true })
      : Promise.resolve({ data: [] as PriorityRow[] }),
    lastPlanRes.data
      ? supabase
          .from('weekly_priorities')
          .select('id, position, text')
          .eq('weekly_plan_id', lastPlanRes.data.id)
          .order('position', { ascending: true })
      : Promise.resolve({ data: [] as PriorityRow[] }),
  ]);

  // Build habit context: include all active habits, fill in last-week count from view.
  const summaryByHabit = new Map<string, WeeklyHabitSummary>();
  for (const row of (lastWeekSummaryRes.data ?? []) as WeeklyHabitSummary[]) {
    summaryByHabit.set(row.habit_id, row);
  }

  const habitContext: HabitContextRow[] = (
    (habitsRes.data ?? []) as { id: string; name: string; area: Area }[]
  ).map((h) => ({
    id: h.id,
    name: h.name,
    area: h.area,
    completed: summaryByHabit.get(h.id)?.completed_count ?? 0,
  }));

  const currentPriorities = ((currentPrioritiesRes.data ?? []) as PriorityRow[]).map((p) => ({
    id: p.id,
    position: p.position,
    text: p.text,
  }));
  const lastPriorities = ((lastPrioritiesRes.data ?? []) as PriorityRow[]).map((p) => ({
    id: p.id,
    position: p.position,
    text: p.text,
  }));

  return (
    <WeekClient
      weekStart={weekStart}
      weekEnd={weekEnd}
      prevWeek={addDays(weekStart, -7)}
      nextWeek={addDays(weekStart, 7)}
      reflection={planRes.data?.reflection ?? ''}
      prepDone={planRes.data?.prep_checklist ?? []}
      currentPriorities={currentPriorities}
      lastPriorities={lastPriorities}
      habitContext={habitContext}
    />
  );
}
