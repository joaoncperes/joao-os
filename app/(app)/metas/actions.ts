'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { METRIC_META, type GoalKind, type GoalMetric } from '@/lib/goals';

type Result = { ok: true } | { ok: false; error: string };

export interface GoalInput {
  title: string;
  kind: GoalKind;
  metric: GoalMetric;
  targetValue: number;
  dueDate: string | null;
  exerciseId: string | null;
  /** Só para metas manuais de objetivo: valor de partida. */
  startValue: number | null;
  /** Só para metas manuais: unidade livre ("vezes", "min"…). */
  unit: string | null;
}

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Faça login de novo.');
  return { supabase, userId: user.id };
}

function validate(input: GoalInput): string | null {
  if (!input.title.trim()) return 'Dê um nome para a meta.';
  if (!(input.kind === 'weekly' || input.kind === 'target')) return 'Tipo inválido.';
  const meta = METRIC_META[input.metric];
  if (!meta) return 'Métrica inválida.';
  if (input.kind === 'weekly' && !meta.weekly) return 'Essa métrica não funciona como meta semanal.';
  if (!Number.isFinite(input.targetValue) || input.targetValue <= 0) {
    return 'O alvo precisa ser maior que zero.';
  }
  if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) return 'Data inválida.';
  if (input.metric === 'exercise_max' && !input.exerciseId) return 'Escolha o exercício.';
  return null;
}

async function currentExerciseMax(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  exerciseId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from('exercise_sets')
    .select('weight_kg')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .not('weight_kg', 'is', null)
    .order('weight_kg', { ascending: false })
    .limit(1);
  const top = (data ?? [])[0] as { weight_kg: number | null } | undefined;
  return top?.weight_kg ?? null;
}

export async function createGoal(input: GoalInput): Promise<Result> {
  try {
    const err = validate(input);
    if (err) return { ok: false, error: err };
    const { supabase, userId } = await ctx();

    let startValue: number | null = null;
    if (input.metric === 'manual' && input.kind === 'target') startValue = input.startValue ?? 0;
    if (input.metric === 'exercise_max' && input.exerciseId) {
      startValue = await currentExerciseMax(supabase, userId, input.exerciseId);
    }

    const { data: last } = await supabase
      .from('goals')
      .select('position')
      .eq('user_id', userId)
      .order('position', { ascending: false })
      .limit(1);
    const lastPos = ((last ?? [])[0] as { position: number } | undefined)?.position ?? 0;

    const { error } = await supabase.from('goals').insert({
      user_id: userId,
      title: input.title.trim(),
      kind: input.kind,
      metric: input.metric,
      target_value: input.targetValue,
      start_value: startValue,
      current_value: input.metric === 'manual' && input.kind === 'target' ? startValue : null,
      exercise_id: input.metric === 'exercise_max' ? input.exerciseId : null,
      unit: input.metric === 'manual' ? input.unit?.trim() || null : null,
      due_date: input.kind === 'target' ? input.dueDate : null,
      position: lastPos + 10,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath('/metas');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateGoal(id: string, input: GoalInput): Promise<Result> {
  try {
    const err = validate(input);
    if (err) return { ok: false, error: err };
    const { supabase, userId } = await ctx();

    const { data: existing } = await supabase
      .from('goals')
      .select('metric, exercise_id, start_value')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!existing) return { ok: false, error: 'Meta não encontrada.' };
    const prev = existing as { metric: GoalMetric; exercise_id: string | null; start_value: number | null };

    const patch: Record<string, unknown> = {
      title: input.title.trim(),
      kind: input.kind,
      metric: input.metric,
      target_value: input.targetValue,
      due_date: input.kind === 'target' ? input.dueDate : null,
      exercise_id: input.metric === 'exercise_max' ? input.exerciseId : null,
      unit: input.metric === 'manual' ? input.unit?.trim() || null : null,
    };
    // Trocou de métrica/exercício: recalcula o ponto de partida.
    const changedSource = prev.metric !== input.metric || prev.exercise_id !== input.exerciseId;
    if (input.metric === 'manual' && input.kind === 'target') {
      if (changedSource) {
        patch.start_value = input.startValue ?? 0;
        patch.current_value = input.startValue ?? 0;
      }
    } else if (changedSource) {
      patch.current_value = null;
      patch.start_value =
        input.metric === 'exercise_max' && input.exerciseId
          ? await currentExerciseMax(supabase, userId, input.exerciseId)
          : null;
    }

    const { error } = await supabase.from('goals').update(patch).eq('id', id).eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/metas');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateManualValue(id: string, value: number): Promise<Result> {
  try {
    if (!Number.isFinite(value)) return { ok: false, error: 'Valor inválido.' };
    const { supabase, userId } = await ctx();
    const { error } = await supabase
      .from('goals')
      .update({ current_value: value })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('metric', 'manual');
    if (error) return { ok: false, error: error.message };
    revalidatePath('/metas');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteGoal(id: string): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const { error } = await supabase.from('goals').delete().eq('id', id).eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/metas');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function logGoalEntry(goalId: string, value: number, date: string): Promise<Result> {
  try {
    if (!Number.isFinite(value) || value <= 0) return { ok: false, error: 'Valor precisa ser maior que zero.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'Data inválida.' };
    const { supabase, userId } = await ctx();
    const { error } = await supabase
      .from('goal_entries')
      .insert({ user_id: userId, goal_id: goalId, value, entry_date: date });
    if (error) return { ok: false, error: error.message };
    revalidatePath('/metas');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Desfaz o registro mais recente da meta (dentro da semana informada). */
export async function undoLastGoalEntry(goalId: string, weekStart: string): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const { data } = await supabase
      .from('goal_entries')
      .select('id')
      .eq('user_id', userId)
      .eq('goal_id', goalId)
      .gte('entry_date', weekStart)
      .order('created_at', { ascending: false })
      .limit(1);
    const last = ((data ?? []) as { id: string }[])[0];
    if (!last) return { ok: false, error: 'Nada para desfazer nesta semana.' };
    const { error } = await supabase.from('goal_entries').delete().eq('id', last.id).eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/metas');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
