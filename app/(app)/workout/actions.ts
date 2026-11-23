'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

type Result<T = void> = ({ ok: true } & (T extends void ? object : { data: T })) | { ok: false; error: string };

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  const { data: u } = await supabase.from('users').select('time_zone').eq('id', user.id).maybeSingle();
  return { supabase, userId: user.id, tz: u?.time_zone ?? 'America/Sao_Paulo' };
}

/**
 * Cria um treino numa data. O treino pertence ao dia do plano escolhido na aba
 * ('day'), mesmo que a data caia em outro dia da semana — assim um treino de
 * sexta feito no domingo continua aparecendo na aba de sexta.
 * Se já existir um treino vazio nessa data, ele é reaproveitado.
 */
export async function createSessionOnDate({
  date,
  day,
}: {
  date: string;
  day?: number;
}): Promise<Result<{ sessionId: string; sessionDate: string }>> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { ok: false, error: 'Data inválida.' };
    }
    const { supabase, userId } = await ctx();
    const dow =
      day != null && Number.isInteger(day) && day >= 0 && day <= 6
        ? day
        : new Date(`${date}T00:00:00Z`).getUTCDay();

    const { data: split } = await supabase
      .from('workout_split')
      .select('split_name')
      .eq('user_id', userId)
      .eq('day_of_week', dow)
      .maybeSingle();
    const splitName = (split as { split_name: string } | null)?.split_name ?? 'Treino';

    const { data: existing } = await supabase
      .from('workout_sessions')
      .select('id, day_of_week, split_name_snapshot')
      .eq('user_id', userId)
      .eq('session_date', date)
      .maybeSingle();
    if (existing) {
      const ex = existing as { id: string; day_of_week: number; split_name_snapshot: string | null };
      if (ex.day_of_week === dow) {
        return { ok: true, data: { sessionId: ex.id, sessionDate: date } };
      }
      const { count } = await supabase
        .from('exercise_sets')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('session_id', ex.id);
      if ((count ?? 0) > 0) {
        const [y, m, d] = date.split('-');
        return {
          ok: false,
          error: `Já existe um treino (${ex.split_name_snapshot ?? 'outro dia'}) registrado em ${d}/${m}/${y}. Escolha outra data.`,
        };
      }
      // Treino vazio criado por engano: passa para o dia escolhido.
      const { error } = await supabase
        .from('workout_sessions')
        .update({ day_of_week: dow, split_name_snapshot: splitName })
        .eq('id', ex.id)
        .eq('user_id', userId);
      if (error) return { ok: false, error: error.message };
      revalidatePath('/workout');
      return { ok: true, data: { sessionId: ex.id, sessionDate: date } };
    }

    const { data: created, error } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: userId,
        session_date: date,
        day_of_week: dow,
        split_name_snapshot: splitName,
      })
      .select('id')
      .single();
    if (error || !created) {
      if (error?.code === '23505') return { ok: false, error: 'Já existe um treino nessa data.' };
      return { ok: false, error: error?.message ?? 'Não consegui criar o treino.' };
    }
    revalidatePath('/workout');
    revalidatePath('/metas');
    return { ok: true, data: { sessionId: created.id, sessionDate: date } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateSessionDate(input: { sessionId: string; newDate: string }): Promise<Result> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.newDate)) {
      return { ok: false, error: 'Data inválida.' };
    }
    const { supabase, userId } = await ctx();
    // O treino continua no mesmo dia do plano; só a data muda.
    const { error } = await supabase
      .from('workout_sessions')
      .update({ session_date: input.newDate })
      .eq('id', input.sessionId)
      .eq('user_id', userId);
    if (error) {
      if (error.code === '23505') {
        return { ok: false, error: 'Já existe um treino nessa data.' };
      }
      return { ok: false, error: error.message };
    }
    revalidatePath('/workout');
    revalidatePath('/metas');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteSession(sessionId: string): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const { error } = await supabase
      .from('workout_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/workout');
    revalidatePath('/metas');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Cardio — logged standalone on any date (session_id = null), decoupled from
// the weekday split and from workout_sessions' unique(user_id, session_date).
// Cardio can be logged on any day, even alongside a strength session.
// ---------------------------------------------------------------------------

export async function createCardioSession(input: {
  date: string;
  kcal?: number | null;
  distanceKm?: number | null;
  durationMinutes?: number | null;
}): Promise<Result<{ id: string }>> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      return { ok: false, error: 'Data inválida.' };
    }
    const { supabase, userId } = await ctx();
    const { data, error } = await supabase
      .from('cardio_sessions')
      .insert({
        user_id: userId,
        session_id: null,
        session_date: input.date,
        type: 'running',
        kcal: input.kcal ?? null,
        distance_km: input.distanceKm ?? null,
        duration_minutes: input.durationMinutes ?? null,
      })
      .select('id')
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? 'create failed' };
    revalidatePath('/workout');
    revalidatePath('/metas');
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateCardioSession(input: {
  id: string;
  date?: string;
  kcal?: number | null;
  distanceKm?: number | null;
  durationMinutes?: number | null;
}): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const patch: {
      session_date?: string;
      kcal?: number | null;
      distance_km?: number | null;
      duration_minutes?: number | null;
    } = {};
    if (input.date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
        return { ok: false, error: 'Data inválida.' };
      }
      patch.session_date = input.date;
    }
    if (input.kcal !== undefined) patch.kcal = input.kcal;
    if (input.distanceKm !== undefined) patch.distance_km = input.distanceKm;
    if (input.durationMinutes !== undefined) patch.duration_minutes = input.durationMinutes;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabase
      .from('cardio_sessions')
      .update(patch)
      .eq('id', input.id)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/workout');
    revalidatePath('/metas');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteCardioSession(id: string): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const { error } = await supabase
      .from('cardio_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/workout');
    revalidatePath('/metas');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function upsertSet(input: {
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
}): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const completedAt =
      input.weightKg != null && input.reps != null ? new Date().toISOString() : null;

    // Explicit select-then-update/insert. Avoids ON CONFLICT so the action
    // does not depend on the (session_id, exercise_id, set_number) unique
    // constraint being present (constraint state has drifted before; see
    // migration 008). Single-user app — race conditions are negligible.
    const { data: existing, error: selectError } = await supabase
      .from('exercise_sets')
      .select('id')
      .eq('user_id', userId)
      .eq('session_id', input.sessionId)
      .eq('exercise_id', input.exerciseId)
      .eq('set_number', input.setNumber)
      .maybeSingle();
    if (selectError) return { ok: false, error: selectError.message };

    if (existing) {
      const { error } = await supabase
        .from('exercise_sets')
        .update({
          weight_kg: input.weightKg,
          reps: input.reps,
          completed_at: completedAt,
        })
        .eq('id', existing.id)
        .eq('user_id', userId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase.from('exercise_sets').insert({
        user_id: userId,
        session_id: input.sessionId,
        exercise_id: input.exerciseId,
        set_number: input.setNumber,
        weight_kg: input.weightKg,
        reps: input.reps,
        completed_at: completedAt,
      });
      if (error) return { ok: false, error: error.message };
    }

    revalidatePath('/workout');
    revalidatePath('/metas');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
