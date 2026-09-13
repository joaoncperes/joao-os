import { createClient } from '@/lib/supabase/server';
import { dowInTz, addDays, todayInTz, sundayWeekStart } from '@/lib/date';
import type { CardioListRow } from '@/lib/supabase/types';
import {
  WorkoutClient,
  type ExerciseCol,
  type SessionRow,
  type DayTab,
} from './workout-client';

export const metadata = { title: 'Workout — Pedro OS' };

const SHORT_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default async function WorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { day: dayParam } = await searchParams;
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
  const todayDow = dowInTz(tz);
  const isCardioTab = dayParam === 'cardio';
  const day =
    !isCardioTab && dayParam != null && /^[0-6]$/.test(dayParam)
      ? Number(dayParam)
      : todayDow;

  // Day tabs: Sunday-anchored week dates (0..6, Sun..Sat).
  const weekStart = addDays(today, -todayDow);
  const dayTabs: DayTab[] = Array.from({ length: 7 }, (_, dow) => {
    const date = addDays(weekStart, dow);
    return {
      value: String(dow),
      shortName: SHORT_DAY[dow],
      date,
      dateNumber: Number(date.slice(8, 10)),
      isToday: dow === todayDow,
    };
  });

  // Selected day's split + exercises (skipped on the Cardio tab).
  const split = isCardioTab
    ? null
    : (
        await supabase
          .from('workout_split')
          .select('id, split_name, is_rest')
          .eq('user_id', user.id)
          .eq('day_of_week', day)
          .maybeSingle()
      ).data;

  type SplitExRow = {
    position: number;
    default_sets: number;
    exercise: {
      id: string;
      name: string;
      muscle_group_primary: string | null;
      type: string | null;
    } | null;
  };
  const splitExercises: SplitExRow[] = split
    ? ((
        await supabase
          .from('workout_split_exercises')
          .select(
            'position, default_sets, exercise:exercises(id, name, muscle_group_primary, type)',
          )
          .eq('workout_split_id', split.id)
          .order('position', { ascending: true })
          .returns<SplitExRow[]>()
      ).data ?? [])
    : [];

  const exerciseCols: ExerciseCol[] = splitExercises.flatMap((row) => {
    if (!row.exercise) return [];
    return [
      {
        exercise_id: row.exercise.id,
        name: row.exercise.name,
        muscle: row.exercise.muscle_group_primary,
        sets: row.default_sets,
      },
    ];
  });

  const muscles = Array.from(
    new Set(
      splitExercises
        .map((r) => r.exercise?.muscle_group_primary)
        .filter((m): m is string => !!m),
    ),
  );

  // Sessions on this day-of-week (last 12; skipped on the Cardio tab).
  const sessions = isCardioTab
    ? []
    : ((
        await supabase
          .from('workout_sessions')
          .select('id, session_date')
          .eq('user_id', user.id)
          .eq('day_of_week', day)
          .order('session_date', { ascending: false })
          .limit(12)
      ).data ?? []);
  const sessionIds = sessions.map((s) => s.id);

  // All sets for those sessions — include id for PR lookup.
  type SetRow = {
    id: string;
    session_id: string;
    exercise_id: string;
    set_number: number;
    weight_kg: number | null;
    reps: number | null;
    completed_at: string | null;
  };
  const sets: SetRow[] = sessionIds.length
    ? ((
        await supabase
          .from('exercise_sets')
          .select('id, session_id, exercise_id, set_number, weight_kg, reps, completed_at')
          .in('session_id', sessionIds)
          .returns<SetRow[]>()
      ).data ?? [])
    : [];

  // Cardio sessions for the Cardio tab — all dates, newest first (independent of
  // day-of-week). Multiple per date are allowed now → created_at tiebreak.
  let cardioRows: CardioListRow[] = [];
  let cardioStats: { thisWeekKcal: number; lastKcal: number | null; sessionCount: number } = {
    thisWeekKcal: 0,
    lastKcal: null,
    sessionCount: 0,
  };
  if (isCardioTab) {
    const { data } = await supabase
      .from('cardio_sessions')
      .select('id, session_date, kcal')
      .eq('user_id', user.id)
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false })
      .returns<CardioListRow[]>();
    cardioRows = data ?? [];
    const wk = sundayWeekStart(today);
    cardioStats = {
      sessionCount: cardioRows.length,
      lastKcal: cardioRows.find((r) => r.kcal != null)?.kcal ?? null,
      thisWeekKcal: cardioRows.reduce(
        (s, r) =>
          s + (r.kcal != null && sundayWeekStart(r.session_date) === wk ? r.kcal : 0),
        0,
      ),
    };
  }

  // PR lookup: any personal_records row whose set_id is in our displayed sets.
  const setIds = sets.map((s) => s.id);
  const prSetIds = new Set<string>();
  if (setIds.length > 0) {
    const { data: prRows } = await supabase
      .from('personal_records')
      .select('set_id')
      .eq('user_id', user.id)
      .in('set_id', setIds);
    for (const r of (prRows ?? []) as { set_id: string | null }[]) {
      if (r.set_id) prSetIds.add(r.set_id);
    }
  }

  // Pivot sets into sessionId → exerciseId → setNumber → cell.
  const setMap: Record<
    string,
    Record<string, Record<number, { weight: number | null; reps: number | null; isPr: boolean }>>
  > = {};
  for (const s of sets) {
    setMap[s.session_id] ??= {};
    setMap[s.session_id][s.exercise_id] ??= {};
    setMap[s.session_id][s.exercise_id][s.set_number] = {
      weight: s.weight_kg,
      reps: s.reps,
      isPr: prSetIds.has(s.id),
    };
  }

  const sessionRows: SessionRow[] = sessions.map((s) => ({
    id: s.id,
    date: s.session_date,
    sets: setMap[s.id] ?? {},
  }));

  // Rest timer: latest completed_at within today's session (only when viewing today's tab).
  const todaySession =
    day === todayDow && sessions[0]?.session_date === today ? sessions[0] : null;
  const todayLastCompletedAt = todaySession
    ? sets
        .filter(
          (s) =>
            s.session_id === todaySession.id &&
            s.weight_kg != null &&
            s.reps != null &&
            s.completed_at != null,
        )
        .reduce<string | null>(
          (max, s) => (max == null || s.completed_at! > max ? s.completed_at! : max),
          null,
        )
    : null;

  // Stats for the displayed day's most recent session.
  function calcVolume(row?: SessionRow): number {
    if (!row) return 0;
    let total = 0;
    for (const byEx of Object.values(row.sets)) {
      for (const cell of Object.values(byEx)) {
        total += (cell.weight ?? 0) * (cell.reps ?? 0);
      }
    }
    return total;
  }
  const lastSession = sessionRows[0];
  const prevSession = sessionRows[1];
  const lastVolume = calcVolume(lastSession);
  const prevVolume = calcVolume(prevSession);
  const volumeDeltaPct =
    prevVolume > 0 ? Math.round(((lastVolume - prevVolume) / prevVolume) * 100) : 0;

  let prCountThisSession = 0;
  if (lastSession) {
    for (const byEx of Object.values(lastSession.sets)) {
      for (const cell of Object.values(byEx)) {
        if (cell.isPr) prCountThisSession++;
      }
    }
  }

  const totalSets = exerciseCols.reduce((acc, e) => acc + e.sets, 0);

  return (
    <WorkoutClient
      day={day}
      todayDow={todayDow}
      today={today}
      dayTabs={dayTabs}
      cardioTab={isCardioTab}
      cardioRows={cardioRows}
      cardioStats={cardioStats}
      splitName={split?.split_name ?? 'No split configured'}
      isRest={!!split?.is_rest}
      muscles={muscles}
      fullDayName={FULL_DAY[day]}
      exercises={exerciseCols}
      sessions={sessionRows}
      todayLastCompletedAt={todayLastCompletedAt}
      stats={{
        lastSessionDate: lastSession?.date ?? null,
        sessionCount: sessionRows.length,
        lastVolume,
        volumeDeltaPct,
        prCountThisSession,
        totalSets,
      }}
    />
  );
}
