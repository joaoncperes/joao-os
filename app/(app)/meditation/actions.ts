'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: string };

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  const { data: u } = await supabase
    .from('users')
    .select('time_zone')
    .eq('id', user.id)
    .maybeSingle();
  return { supabase, userId: user.id, tz: u?.time_zone ?? 'America/Sao_Paulo' };
}

function dowFromDate(dateISO: string): number {
  return new Date(`${dateISO}T00:00:00Z`).getUTCDay();
}

/**
 * Create an empty meditation log row on an explicit date. Fails if a log
 * already exists for that date (uniqueness enforced via DB unique index).
 */
export async function createMeditationLogOnDate({
  date,
}: {
  date: string;
}): Promise<Result> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { ok: false, error: 'Invalid date.' };
    }
    const { supabase, userId } = await ctx();
    const dow = dowFromDate(date);

    const { data: existing } = await supabase
      .from('meditation_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('log_date', date)
      .maybeSingle();
    if (existing) {
      return { ok: false, error: 'A meditation log already exists on this date.' };
    }

    const { error } = await supabase.from('meditation_logs').insert({
      user_id: userId,
      log_date: date,
      day_of_week: dow,
      minutes: 0,
    });
    if (error) {
      if (error.code === '23505') {
        return { ok: false, error: 'A meditation log already exists on this date.' };
      }
      return { ok: false, error: error.message };
    }

    revalidatePath('/meditation');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Upsert minutes for a given log date. Creates the row if it doesn't exist
 * yet (so the user can just type minutes into today's empty cell without
 * having to explicitly "add session" first).
 */
export async function upsertMeditationLog(input: {
  logDate: string;
  minutes: number;
}): Promise<Result> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.logDate)) {
      return { ok: false, error: 'Invalid date.' };
    }
    if (!Number.isFinite(input.minutes) || input.minutes < 0) {
      return { ok: false, error: 'Minutes must be a non-negative number.' };
    }
    const minutes = Math.round(input.minutes);
    const { supabase, userId } = await ctx();

    const { data: existing, error: selectError } = await supabase
      .from('meditation_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('log_date', input.logDate)
      .maybeSingle();
    if (selectError) return { ok: false, error: selectError.message };

    if (existing) {
      const { error } = await supabase
        .from('meditation_logs')
        .update({ minutes })
        .eq('id', existing.id)
        .eq('user_id', userId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase.from('meditation_logs').insert({
        user_id: userId,
        log_date: input.logDate,
        day_of_week: dowFromDate(input.logDate),
        minutes,
      });
      if (error) return { ok: false, error: error.message };
    }

    revalidatePath('/meditation');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateMeditationLogDate(input: {
  logId: string;
  newDate: string;
}): Promise<Result> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.newDate)) {
      return { ok: false, error: 'Invalid date.' };
    }
    const { supabase, userId } = await ctx();
    const dow = dowFromDate(input.newDate);
    const { error } = await supabase
      .from('meditation_logs')
      .update({ log_date: input.newDate, day_of_week: dow })
      .eq('id', input.logId)
      .eq('user_id', userId);
    if (error) {
      if (error.code === '23505') {
        return { ok: false, error: 'A meditation log already exists on this date.' };
      }
      return { ok: false, error: error.message };
    }
    revalidatePath('/meditation');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteMeditationLog(logId: string): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const { error } = await supabase
      .from('meditation_logs')
      .delete()
      .eq('id', logId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/meditation');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
