'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface PlanDayInput {
  dayOfWeek: number; // 0 = domingo … 6 = sábado
  name: string;
  isRest: boolean;
  exercises: { name: string; sets: number }[];
}

type Result = { ok: true } | { ok: false; error: string };

export async function savePlan(days: PlanDayInput[]): Promise<Result> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Faça login de novo.' };
    const userId = user.id;

    for (const d of days) {
      if (!Number.isInteger(d.dayOfWeek) || d.dayOfWeek < 0 || d.dayOfWeek > 6) {
        return { ok: false, error: 'Dia inválido.' };
      }
    }

    // 1. Garante que todos os exercícios existem (pelo nome, sem diferenciar maiúsculas).
    const { data: existingRows, error: exErr } = await supabase
      .from('exercises')
      .select('id, name, archived')
      .eq('user_id', userId);
    if (exErr) return { ok: false, error: exErr.message };
    const byName = new Map<string, string>();
    for (const e of (existingRows ?? []) as { id: string; name: string; archived: boolean }[]) {
      byName.set(e.name.trim().toLowerCase(), e.id);
    }

    const wanted = new Map<string, string>(); // lower → nome original
    for (const d of days) {
      if (d.isRest) continue;
      for (const ex of d.exercises) {
        const name = ex.name.trim();
        if (name) wanted.set(name.toLowerCase(), name);
      }
    }
    const missing = [...wanted.entries()].filter(([k]) => !byName.has(k)).map(([, v]) => v);
    if (missing.length) {
      const { data: inserted, error } = await supabase
        .from('exercises')
        .insert(missing.map((name) => ({ user_id: userId, name, type: 'compound' })))
        .select('id, name');
      if (error) return { ok: false, error: `exercícios: ${error.message}` };
      for (const e of (inserted ?? []) as { id: string; name: string }[]) {
        byName.set(e.name.trim().toLowerCase(), e.id);
      }
    }
    // Reativa exercícios arquivados que voltaram ao plano.
    const archivedIds = ((existingRows ?? []) as { id: string; name: string; archived: boolean }[])
      .filter((e) => e.archived && wanted.has(e.name.trim().toLowerCase()))
      .map((e) => e.id);
    if (archivedIds.length) {
      await supabase.from('exercises').update({ archived: false }).in('id', archivedIds);
    }

    // 2. Salva cada dia e substitui a lista de exercícios.
    const { data: splitRows, error: splitErr } = await supabase
      .from('workout_split')
      .select('id, day_of_week')
      .eq('user_id', userId);
    if (splitErr) return { ok: false, error: splitErr.message };
    const splitByDow = new Map<number, string>();
    for (const r of (splitRows ?? []) as { id: string; day_of_week: number }[]) {
      splitByDow.set(r.day_of_week, r.id);
    }

    for (const d of days) {
      const splitName = d.name.trim() || (d.isRest ? 'Descanso' : 'Treino');
      let splitId = splitByDow.get(d.dayOfWeek);
      if (splitId) {
        const { error } = await supabase
          .from('workout_split')
          .update({ split_name: splitName, is_rest: d.isRest })
          .eq('id', splitId)
          .eq('user_id', userId);
        if (error) return { ok: false, error: error.message };
      } else {
        const { data: created, error } = await supabase
          .from('workout_split')
          .insert({ user_id: userId, day_of_week: d.dayOfWeek, split_name: splitName, is_rest: d.isRest })
          .select('id')
          .single();
        if (error || !created) return { ok: false, error: error?.message ?? 'erro ao criar dia' };
        splitId = (created as { id: string }).id;
      }

      const { error: delErr } = await supabase
        .from('workout_split_exercises')
        .delete()
        .eq('workout_split_id', splitId)
        .eq('user_id', userId);
      if (delErr) return { ok: false, error: delErr.message };

      if (d.isRest) continue;
      const rows = d.exercises
        .filter((ex) => ex.name.trim())
        .map((ex, i) => ({
          user_id: userId,
          workout_split_id: splitId,
          exercise_id: byName.get(ex.name.trim().toLowerCase()) as string,
          position: i + 1,
          default_sets: Math.min(10, Math.max(1, Math.round(ex.sets) || 3)),
        }));
      if (rows.length) {
        const { error } = await supabase.from('workout_split_exercises').insert(rows);
        if (error) return { ok: false, error: error.message };
      }
    }

    revalidatePath('/workout');
    revalidatePath('/workout/plano');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
