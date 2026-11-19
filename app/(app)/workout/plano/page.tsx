import { requireAuth } from '@/lib/auth-gate';
import { createClient } from '@/lib/supabase/server';
import { PlanEditor, type PlanDay } from './plan-editor';

export const metadata = { title: 'Plano de treino — João OS' };
export const dynamic = 'force-dynamic';

// Segunda a domingo (day_of_week: 0 = domingo).
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAME = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default async function PlanoPage() {
  const { userId } = await requireAuth('complete');
  const supabase = await createClient();

  type SplitRow = {
    id: string;
    day_of_week: number;
    split_name: string;
    is_rest: boolean;
    items:
      | { position: number; default_sets: number; exercise: { name: string } | { name: string }[] | null }[]
      | null;
  };

  const [{ data: splitRows }, { data: exerciseRows }] = await Promise.all([
    supabase
      .from('workout_split')
      .select(
        'id, day_of_week, split_name, is_rest, items:workout_split_exercises(position, default_sets, exercise:exercises(name))',
      )
      .eq('user_id', userId),
    supabase
      .from('exercises')
      .select('name')
      .eq('user_id', userId)
      .eq('archived', false)
      .order('name', { ascending: true }),
  ]);

  const byDow = new Map<number, SplitRow>();
  for (const r of (splitRows ?? []) as SplitRow[]) byDow.set(r.day_of_week, r);

  const days: PlanDay[] = ORDER.map((dow) => {
    const row = byDow.get(dow);
    const items = [...(row?.items ?? [])].sort((a, b) => a.position - b.position);
    return {
      dayOfWeek: dow,
      label: DAY_NAME[dow],
      name: row?.split_name ?? '',
      isRest: row?.is_rest ?? false,
      exercises: items
        .map((it) => {
          const ex = Array.isArray(it.exercise) ? it.exercise[0] : it.exercise;
          return { name: ex?.name ?? '', sets: it.default_sets };
        })
        .filter((e) => e.name),
    };
  });

  const known = ((exerciseRows ?? []) as { name: string }[]).map((e) => e.name);

  return <PlanEditor initialDays={days} knownExercises={known} />;
}
