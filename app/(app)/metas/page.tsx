import { requireAuth } from '@/lib/auth-gate';
import { createClient } from '@/lib/supabase/server';
import { todayInTz } from '@/lib/date';
import {
  mondayOf,
  plusDays,
  progressRatio,
  targetCurrent,
  weeklyStreak,
  weeklyValue,
  type ActivityData,
  type Goal,
} from '@/lib/goals';
import { MetasClient, type TargetCard, type WeeklyCard } from './metas-client';

export const metadata = { title: 'Metas — João OS' };
export const dynamic = 'force-dynamic';

const HISTORY_WEEKS = 8;

export default async function MetasPage() {
  const { userId, timeZone } = await requireAuth('complete');
  const supabase = await createClient();
  const today = todayInTz(timeZone);
  const weekStart = mondayOf(today);

  const { data: goalRows, error: goalsError } = await supabase
    .from('goals')
    .select(
      'id, title, kind, metric, target_value, start_value, current_value, exercise_id, start_date, due_date, position',
    )
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('position', { ascending: true });

  const goals: Goal[] = ((goalRows ?? []) as Goal[]).map((g) => ({
    ...g,
    target_value: Number(g.target_value),
    start_value: g.start_value == null ? null : Number(g.start_value),
    current_value: g.current_value == null ? null : Number(g.current_value),
  }));

  // Janela de dados: histórico semanal + início do objetivo mais antigo.
  let from = plusDays(weekStart, -7 * (HISTORY_WEEKS - 1));
  for (const g of goals) {
    if (g.kind === 'target' && g.start_date < from) from = g.start_date;
  }

  const exerciseIds = goals
    .filter((g) => g.metric === 'exercise_max' && g.exercise_id)
    .map((g) => g.exercise_id as string);

  const [sessionsRes, runsRes, readingRes, booksRes, maxRes, exercisesRes] = await Promise.all([
    supabase
      .from('workout_sessions')
      .select('id, session_date')
      .eq('user_id', userId)
      .gte('session_date', from),
    supabase
      .from('cardio_sessions')
      .select('session_date, distance_km')
      .eq('user_id', userId)
      .gte('session_date', from),
    supabase
      .from('reading_sessions')
      .select('session_date, minutes')
      .eq('user_id', userId)
      .gte('session_date', from),
    supabase
      .from('books')
      .select('finished_at')
      .eq('user_id', userId)
      .eq('priority', 'lido')
      .gte('finished_at', from),
    exerciseIds.length
      ? supabase
          .from('exercise_sets')
          .select('exercise_id, weight_kg')
          .eq('user_id', userId)
          .in('exercise_id', exerciseIds)
          .not('weight_kg', 'is', null)
      : Promise.resolve({ data: [] as { exercise_id: string; weight_kg: number }[] }),
    supabase
      .from('exercises')
      .select('id, name')
      .eq('user_id', userId)
      .eq('archived', false)
      .order('name', { ascending: true }),
  ]);

  // Uma sessão só conta como treino se tiver pelo menos uma série preenchida.
  const sessions = (sessionsRes.data ?? []) as { id: string; session_date: string }[];
  let workoutDates: string[] = [];
  if (sessions.length) {
    const { data: setRows } = await supabase
      .from('exercise_sets')
      .select('session_id')
      .eq('user_id', userId)
      .in(
        'session_id',
        sessions.map((s) => s.id),
      )
      .not('reps', 'is', null);
    const withSets = new Set(((setRows ?? []) as { session_id: string }[]).map((r) => r.session_id));
    workoutDates = sessions.filter((s) => withSets.has(s.id)).map((s) => s.session_date);
  }

  const exerciseMax: Record<string, number> = {};
  for (const r of (maxRes.data ?? []) as { exercise_id: string; weight_kg: number | null }[]) {
    const w = Number(r.weight_kg);
    if (Number.isFinite(w) && w > (exerciseMax[r.exercise_id] ?? -Infinity)) {
      exerciseMax[r.exercise_id] = w;
    }
  }

  const data: ActivityData = {
    workoutDates,
    runs: ((runsRes.data ?? []) as { session_date: string; distance_km: number | null }[]).map((r) => ({
      date: r.session_date,
      km: r.distance_km == null ? null : Number(r.distance_km),
    })),
    reading: ((readingRes.data ?? []) as { session_date: string; minutes: number }[]).map((r) => ({
      date: r.session_date,
      minutes: Number(r.minutes),
    })),
    booksFinishedDates: ((booksRes.data ?? []) as { finished_at: string | null }[])
      .map((b) => b.finished_at)
      .filter((d): d is string => !!d),
    exerciseMax,
  };

  const exercises = (exercisesRes.data ?? []) as { id: string; name: string }[];
  const exerciseName = new Map(exercises.map((e) => [e.id, e.name]));

  const weekly: WeeklyCard[] = goals
    .filter((g) => g.kind === 'weekly')
    .map((g) => {
      const history = Array.from({ length: HISTORY_WEEKS }, (_, i) => {
        const ws = plusDays(weekStart, -7 * (HISTORY_WEEKS - 1 - i));
        const value = weeklyValue(g, data, ws);
        return {
          weekStart: ws,
          value,
          met: value >= g.target_value,
          beforeGoal: plusDays(ws, 6) < g.start_date,
        };
      });
      const value = history[history.length - 1].value;
      return {
        goal: g,
        value,
        ratio: progressRatio(value, g.target_value, null),
        streak: weeklyStreak(g, data, weekStart),
        history,
      };
    });

  const targets: TargetCard[] = goals
    .filter((g) => g.kind === 'target')
    .map((g) => {
      const current = targetCurrent(g, data, today);
      return {
        goal: g,
        current,
        ratio: progressRatio(current, g.target_value, g.start_value),
        exerciseName: g.exercise_id ? exerciseName.get(g.exercise_id) ?? null : null,
      };
    });

  return (
    <MetasClient
      today={today}
      weekStart={weekStart}
      weekly={weekly}
      targets={targets}
      exercises={exercises}
      loadError={goalsError?.message ?? null}
    />
  );
}
