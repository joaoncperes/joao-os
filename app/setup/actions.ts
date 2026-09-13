'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  DEFAULT_EXERCISES,
  type DefaultHabit,
  type DefaultSplitDay,
} from '@/lib/seed';

type ActionResult = { ok?: true; error?: string };

async function getUserId(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };
  return { supabase, userId: user.id };
}

export async function saveAccount(input: {
  name: string;
  timeZone: string;
  weekStartDay: number;
}): Promise<ActionResult> {
  const ctx = await getUserId();
  if ('error' in ctx) return ctx;

  const { error } = await ctx.supabase
    .from('users')
    .update({
      name: input.name,
      time_zone: input.timeZone,
      week_start_day: input.weekStartDay,
    })
    .eq('id', ctx.userId);

  if (error) return { error: error.message };
  revalidatePath('/setup');
  return { ok: true };
}

export async function saveHabits(habits: DefaultHabit[]): Promise<ActionResult> {
  const ctx = await getUserId();
  if ('error' in ctx) return ctx;

  // Idempotent: skip if any habit already exists for this user.
  const { data: existing } = await ctx.supabase
    .from('habits')
    .select('id')
    .eq('user_id', ctx.userId)
    .limit(1);

  if (existing && existing.length > 0) {
    return { ok: true }; // already seeded
  }

  const rows = habits.map((h) => ({
    user_id: ctx.userId,
    name: h.name,
    area: h.area,
    time_slot: h.time_slot,
    is_counter: h.is_counter,
    counter_target_value: h.counter_target_value ?? null,
    counter_unit: h.counter_unit ?? null,
    reminder_lead_minutes: h.reminder_lead_minutes,
    sort_order: h.sort_order,
  }));

  const { error } = await ctx.supabase.from('habits').insert(rows);
  if (error) return { error: error.message };

  revalidatePath('/setup');
  return { ok: true };
}

export async function finishSetup(input: { split: DefaultSplitDay[] }): Promise<ActionResult> {
  const ctx = await getUserId();
  if ('error' in ctx) return ctx;
  const { supabase, userId } = ctx;

  // 1. Idempotent exercise seed.
  const { data: existingExercises } = await supabase
    .from('exercises')
    .select('id, name')
    .eq('user_id', userId);

  const haveByName = new Map((existingExercises ?? []).map((e) => [e.name, e.id]));

  const toInsert = DEFAULT_EXERCISES.filter((e) => !haveByName.has(e.name)).map((e) => ({
    user_id: userId,
    name: e.name,
    type: e.type,
    muscle_group_primary: e.muscle_group_primary,
  }));

  if (toInsert.length > 0) {
    const { data: inserted, error } = await supabase
      .from('exercises')
      .insert(toInsert)
      .select('id, name');
    if (error) return { error: `exercises: ${error.message}` };
    inserted?.forEach((e) => haveByName.set(e.name, e.id));
  }

  // 2. Seed split + split_exercises (idempotent — drop existing first if re-running).
  const { data: existingSplit } = await supabase
    .from('workout_split')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (!existingSplit || existingSplit.length === 0) {
    for (const day of input.split) {
      const { data: dayRow, error: dayErr } = await supabase
        .from('workout_split')
        .insert({
          user_id: userId,
          day_of_week: day.day_of_week,
          split_name: day.split_name,
          is_rest: day.is_rest,
        })
        .select('id')
        .single();

      if (dayErr || !dayRow) return { error: `split day: ${dayErr?.message ?? 'no row'}` };

      const exRows = day.exercises.map((ex, i) => {
        const exId = haveByName.get(ex.name);
        if (!exId) throw new Error(`Missing exercise: ${ex.name}`);
        return {
          user_id: userId,
          workout_split_id: dayRow.id,
          exercise_id: exId,
          position: i + 1,
          default_sets: ex.default_sets,
          default_reps_target: ex.default_reps_target,
        };
      });

      if (exRows.length > 0) {
        const { error: exErr } = await supabase.from('workout_split_exercises').insert(exRows);
        if (exErr) return { error: `split exercises: ${exErr.message}` };
      }
    }
  }

  // 3. Mark setup complete.
  const { error: doneErr } = await supabase
    .from('users')
    .update({ setup_completed_at: new Date().toISOString() })
    .eq('id', userId);

  if (doneErr) return { error: doneErr.message };

  revalidatePath('/');
  revalidatePath('/today');
  return { ok: true };
}
