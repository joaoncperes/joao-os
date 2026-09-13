'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { todayInTz } from '@/lib/date';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface JournalInput {
  win: string | null;
  learned: string | null;
  would_do_differently: string | null;
  one_for_tomorrow: string | null;
  area_pro_score: number | null;
  area_health_score: number | null;
  area_family_score: number | null;
  area_marriage_score: number | null;
  gratitude: string | null;
  gabi_call_depth: number | null;
  gabi_call_topic: string | null;
  free_notes: string | null;
}

/**
 * Save a journal entry for `entryDate`. When `originalDate` is set and differs
 * from `entryDate`, the existing entry is MOVED to the new date (content edited
 * in the same operation). Date collisions are blocked, never overwritten.
 */
export async function saveJournal(
  input: JournalInput,
  entryDate: string,
  originalDate: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data: u } = await supabase
    .from('users')
    .select('time_zone')
    .eq('id', user.id)
    .maybeSingle();
  const tz = u?.time_zone ?? 'America/Sao_Paulo';
  const today = todayInTz(tz);

  // Validate the target date: well-formed and not in the future.
  if (!DATE_RE.test(entryDate)) return { ok: false, error: 'Data inválida.' };
  if (entryDate > today) {
    return { ok: false, error: 'Não dá para registrar um dia futuro.' };
  }

  const required = [
    input.win,
    input.learned,
    input.would_do_differently,
    input.one_for_tomorrow,
    input.area_pro_score,
    input.area_health_score,
    input.area_family_score,
    input.area_marriage_score,
  ];
  const isPartial = required.some((v) => v == null || v === '');

  const fields = {
    win: input.win,
    learned: input.learned,
    would_do_differently: input.would_do_differently,
    one_for_tomorrow: input.one_for_tomorrow,
    area_pro_score: input.area_pro_score,
    area_health_score: input.area_health_score,
    area_family_score: input.area_family_score,
    area_marriage_score: input.area_marriage_score,
    gratitude: input.gratitude
      ? { lines: input.gratitude.split('\n').map((s) => s.trim()).filter(Boolean) }
      : null,
    gabi_call_depth: input.gabi_call_depth,
    gabi_call_topic: input.gabi_call_topic,
    free_notes: input.free_notes,
    is_partial: isPartial,
  };

  // Is there already an entry on the target date?
  const { data: existingAtTarget } = await supabase
    .from('journals')
    .select('id')
    .eq('user_id', user.id)
    .eq('journal_date', entryDate)
    .maybeSingle();

  const isMove = !!originalDate && originalDate !== entryDate;

  if (isMove) {
    // Moving an existing entry to a different date (content edited too).
    if (existingAtTarget) {
      return { ok: false, error: 'Já existe uma entrada nesse dia.' };
    }
    const { error } = await supabase
      .from('journals')
      .update({ journal_date: entryDate, ...fields })
      .eq('user_id', user.id)
      .eq('journal_date', originalDate);
    if (error) {
      if (error.code === '23505') {
        return { ok: false, error: 'Já existe uma entrada nesse dia.' };
      }
      return { ok: false, error: error.message };
    }
  } else {
    // New entry, or update-in-place on the same date.
    if (!originalDate && existingAtTarget) {
      return {
        ok: false,
        error: 'Já existe uma entrada nesse dia. Abra esse dia para editá-la.',
      };
    }
    const { error } = await supabase
      .from('journals')
      .upsert(
        { user_id: user.id, journal_date: entryDate, ...fields },
        { onConflict: 'user_id,journal_date' },
      );
    if (error) return { ok: false, error: error.message };
  }

  // "One for tomorrow" becomes a task tomorrow — only on the first save of
  // TODAY's entry. Skipping edits/back-fills avoids past-dated junk tasks, and
  // the first-save guard avoids duplicate tasks when re-saving the same day.
  if (
    entryDate === today &&
    !existingAtTarget &&
    input.one_for_tomorrow &&
    input.one_for_tomorrow.trim()
  ) {
    const tomorrow = new Date(`${entryDate}T00:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    await supabase.from('tasks').insert({
      user_id: user.id,
      title: input.one_for_tomorrow.trim(),
      scheduled_date: tomorrow.toISOString().slice(0, 10),
    });
  }

  revalidatePath('/journal');
  revalidatePath('/today');
  return { ok: true };
}
