import Link from 'next/link';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { todayInTz, isoWeekInfo, addDays, dowInTz, sundayWeekStart } from '@/lib/date';
import { cn } from '@/lib/utils';
import { SectionHeader } from '@/components/ui/section-header';
import { StatCard } from '@/components/ui/stat-card';
import { GlyphCell, type GlyphState } from '@/components/ui/glyph-cell';
import { AreaChip } from '@/components/area-chip';
import { VolumeProgression } from './volume-progression';
import { CardioCalories } from './cardio-calories';
import type { Area, CardioWeeklyRow, VolumeSessionRow } from '@/lib/supabase/types';

export const metadata = { title: 'Insights — Pedro OS' };

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface HabitRow {
  id: string;
  name: string;
  area: Area;
  time_slot: string | null;
}

export default async function InsightsPage({
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
  const today = todayInTz(tz);
  const ref = week ?? today;
  const info = isoWeekInfo(ref);
  const days = Array.from({ length: 7 }, (_, i) => addDays(info.weekStart, i));

  const { data: habits } = await supabase
    .from('habits')
    .select('id, name, area, time_slot, sort_order')
    .eq('user_id', user.id)
    .eq('archived', false)
    .order('time_slot', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true });

  const { data: logs } = await supabase
    .from('habit_logs')
    .select('habit_id, log_date, completed_at, miss_reason, freeze_used')
    .eq('user_id', user.id)
    .gte('log_date', days[0])
    .lte('log_date', days[6]);

  // --- Workout volume progression (all-time; independent of the week selector) ---
  const { data: volumeRows } = await supabase
    .from('v_workout_session_volume')
    .select(
      'session_id, session_date, day_of_week, split_name_snapshot, total_volume, total_sets',
    )
    .eq('user_id', user.id)
    .gt('total_sets', 0) // drops cardio (0 sets) and never-logged sessions
    .order('session_date', { ascending: true })
    .returns<VolumeSessionRow[]>();

  // Per training day (Sun/Mon/Wed/Fri/Sat) → chronological points, plus a
  // Sunday-anchored weekly total. total_volume is numeric → normalize w/ Number().
  const perDaySeries: Record<number, { date: string; volume: number; sets: number }[]> = {
    0: [],
    1: [],
    3: [],
    5: [],
    6: [],
  };
  const weeklyMap = new Map<string, { weekStart: string; volume: number; sessions: number }>();
  for (const r of volumeRows ?? []) {
    const vol = Number(r.total_volume);
    if (r.day_of_week in perDaySeries) {
      perDaySeries[r.day_of_week].push({ date: r.session_date, volume: vol, sets: r.total_sets });
    }
    const ws = sundayWeekStart(r.session_date);
    const cur = weeklyMap.get(ws) ?? { weekStart: ws, volume: 0, sessions: 0 };
    cur.volume += vol;
    cur.sessions += 1;
    weeklyMap.set(ws, cur);
  }
  const weeklySeries = [...weeklyMap.values()].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));

  // --- Weekly cardio calories (all-time; Sunday-anchored, mirrors volume) ---
  const { data: cardioRows } = await supabase
    .from('cardio_sessions')
    .select('session_date, kcal')
    .eq('user_id', user.id)
    .not('kcal', 'is', null)
    .order('session_date', { ascending: true })
    .returns<{ session_date: string; kcal: number | null }[]>();
  const cardioWeeklyMap = new Map<string, CardioWeeklyRow>();
  for (const r of cardioRows ?? []) {
    if (r.kcal == null) continue;
    const ws = sundayWeekStart(r.session_date);
    const cur = cardioWeeklyMap.get(ws) ?? { weekStart: ws, kcal: 0, sessions: 0 };
    cur.kcal += r.kcal;
    cur.sessions += 1;
    cardioWeeklyMap.set(ws, cur);
  }
  const cardioWeekly = [...cardioWeeklyMap.values()].sort((a, b) =>
    a.weekStart < b.weekStart ? -1 : 1,
  );

  // Pivot: habit_id → date → state
  const stateMap = new Map<string, Map<string, GlyphState>>();
  for (const l of logs ?? []) {
    const inner = stateMap.get(l.habit_id) ?? new Map();
    let state: GlyphState = 'empty';
    if (l.completed_at) state = 'done';
    else if (l.freeze_used) state = 'freeze';
    else if (l.miss_reason) state = 'miss';
    inner.set(l.log_date, state);
    stateMap.set(l.habit_id, inner);
  }

  const habitRows = (habits ?? []) as HabitRow[];

  // Compute matrix + counts
  const matrix: GlyphState[][] = habitRows.map((h) =>
    days.map((d) => {
      if (d > today) return 'future';
      return stateMap.get(h.id)?.get(d) ?? 'empty';
    }),
  );

  let doneCount = 0;
  let missCount = 0;
  let freezeCount = 0;
  for (const row of matrix) {
    for (const state of row) {
      if (state === 'done') doneCount++;
      else if (state === 'miss') missCount++;
      else if (state === 'freeze') freezeCount++;
    }
  }
  const possible = habitRows.length * 7;
  const completionPct = possible > 0 ? Math.round((doneCount / possible) * 100) : 0;
  const consistency =
    doneCount + missCount === 0 ? 0 : Math.round((doneCount / (doneCount + missCount)) * 100);

  // Header strings
  const startMd = info.weekStart.slice(5);   // MM-DD
  const endMd = days[6].slice(5);
  const subtitle = `Week of ${info.weekStart} · ${habitRows.length} active habits across 7 days`;

  return (
    <div className="flex flex-col">
      <SectionHeader
        eyebrow={`Habit Tracking · W${info.isoWeek}`}
        title="Insights"
        subtitle={subtitle}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/insights/habits"
              className="bg-surface border-border text-text-2 hover:bg-surface-2 hover:text-text inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors"
            >
              <CalendarRange className="h-3.5 w-3.5" />
              Year view
            </Link>
            <div className="bg-surface border-border flex items-center gap-1.5 rounded-lg border p-1">
              <Link
                href={`/insights?week=${addDays(info.weekStart, -7)}`}
                className="text-text-2 hover:bg-surface-2 hover:text-text inline-flex items-center gap-1 rounded-[5px] px-2.5 py-1.5 text-[13px] font-medium transition-colors"
                aria-label="Previous week"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Link>
              <span className="border-border text-text border-l border-r px-2.5 py-1.5 text-[13px] font-semibold tabular-nums">
                W{info.isoWeek} · {startMd} → {endMd}
              </span>
              <Link
                href={`/insights?week=${addDays(info.weekStart, 7)}`}
                className="text-text-2 hover:bg-surface-2 hover:text-text inline-flex items-center gap-1 rounded-[5px] px-2.5 py-1.5 text-[13px] font-medium transition-colors"
                aria-label="Next week"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Completion"
          value={completionPct}
          unit="%"
          bar={{ pct: completionPct, tone: 'success' }}
        />
        <StatCard
          label="Done"
          value={doneCount}
          unit={`of ${possible}`}
          bar={{ pct: possible > 0 ? (doneCount / possible) * 100 : 0, tone: 'accent' }}
        />
        <StatCard
          label="Misses"
          value={missCount}
          bar={{ pct: possible > 0 ? (missCount / possible) * 100 : 0, tone: 'danger' }}
        />
        <StatCard
          label="Consistency"
          value={consistency}
          unit="%"
          bar={{ pct: consistency, tone: 'success' }}
        />
      </div>

      <div className="bg-surface border-border overflow-hidden rounded-xl border">
        <div className="border-border flex items-center justify-between gap-4 border-b px-5 py-4">
          <h3 className="text-text m-0 text-[14px] font-semibold">Weekly habit grid</h3>
          <div className="text-text-3 text-xs font-medium">
            {doneCount} done · {missCount} missed · {freezeCount} freeze
          </div>
        </div>

        {habitRows.length === 0 ? (
          <div className="text-text-3 px-6 py-12 text-center text-[13px]">
            <div className="text-text mb-1 text-base font-semibold">No habits yet</div>
            Add some in Setup to start tracking.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="border-collapse w-full min-w-[392px] sm:min-w-[720px]"
              style={{ borderSpacing: 0 }}
            >
              <thead>
                <tr>
                  <th
                    className="bg-surface-2 text-text-3 border-border sticky left-0 z-30 border-b px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.06em] min-w-[140px] sm:min-w-[220px]"
                    style={{ boxShadow: '1px 0 0 var(--border)' }}
                  >
                    Habit
                  </th>
                  {days.map((d, i) => {
                    const isToday = d === today;
                    return (
                      <th
                        key={d}
                        className={cn(
                          'bg-surface-2 border-border border-b px-1 py-3 text-center text-[11px] font-medium uppercase tracking-[0.06em] w-9 sm:w-14 sm:px-2',
                          isToday ? 'text-accent' : 'text-text-3',
                        )}
                      >
                        <span
                          className={cn(
                            'block text-[12px] font-semibold',
                            isToday ? 'text-accent' : 'text-text-2',
                          )}
                        >
                          {DAY_LABELS[i]}
                        </span>
                        <span
                          className={cn(
                            'block text-[11px] tabular-nums',
                            isToday ? 'text-accent font-semibold' : 'text-text-4',
                          )}
                        >
                          {d.slice(5)}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {habitRows.map((h, hi) => (
                  <tr key={h.id}>
                    <td
                      className="bg-surface border-border sticky left-0 z-10 border-t"
                      style={{ boxShadow: '1px 0 0 var(--border)' }}
                    >
                      <div className="flex flex-col gap-1 px-4 py-3">
                        <span className="text-text text-[13.5px] font-semibold leading-tight">
                          {h.name}
                        </span>
                        <div className="flex items-center gap-2">
                          {h.time_slot ? (
                            <span className="text-text-3 text-[11px] font-medium tabular-nums">
                              {h.time_slot.slice(0, 5)}
                            </span>
                          ) : null}
                          <AreaChip area={h.area} />
                        </div>
                      </div>
                    </td>
                    {days.map((d, di) => {
                      const isToday = d === today;
                      const state = matrix[hi][di];
                      return (
                        <td
                          key={d}
                          className={cn(
                            'border-border border-t px-1 py-2 text-center sm:px-2',
                            isToday && 'bg-accent-tint',
                          )}
                        >
                          <GlyphCell state={state} today={isToday} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="bg-surface-2 border-border text-text-3 flex flex-wrap gap-4 border-t px-5 py-3 text-xs">
          <LegendItem state="done" label="Done" />
          <LegendItem state="miss" label="Missed" />
          <LegendItem state="freeze" label="Freeze used" />
          <LegendItem state="empty" label="No log" />
          <LegendItem state="future" label="Future" />
        </div>
      </div>

      <VolumeProgression perDay={perDaySeries} weekly={weeklySeries} todayDow={dowInTz(tz)} />

      <CardioCalories weekly={cardioWeekly} />

      <p className="text-text-3 mt-4 text-xs">
        <strong className="text-text-2">Coming in V2 ·</strong> Per-habit deep-dives, area-score
        line charts over time, and AI-generated weekly insights.
      </p>
    </div>
  );
}

function LegendItem({ state, label }: { state: GlyphState; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
      <GlyphCell state={state} size={18} />
      {label}
    </span>
  );
}
