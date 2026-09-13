'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { sundayWeekStart } from '@/lib/date';

const PREP_KEYS = ['inbox', 'calendar', 'desktop', 'second_brain', 'tasks'] as const;

type Result = { ok: true } | { ok: false; error: string };

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  return { supabase, userId: user.id };
}

async function getOrCreatePlan(weekDate: string) {
  const { supabase, userId } = await ctx();
  const weekStart = sundayWeekStart(weekDate);

  const { data: existing } = await supabase
    .from('weekly_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('week_start_date', weekStart)
    .maybeSingle();
  if (existing) return { planId: existing.id, userId, supabase };

  const { data: created, error } = await supabase
    .from('weekly_plans')
    .insert({
      user_id: userId,
      week_start_date: weekStart,
    })
    .select('id')
    .single();
  if (error || !created) throw new Error(error?.message ?? 'plan create failed');
  return { planId: created.id, userId, supabase };
}

export async function saveWeeklyPlan(input: {
  weekDate: string;
  reflection: string | null;
  prepChecklist: string[];
  priorities: { text: string }[];
}): Promise<Result> {
  try {
    const { supabase, planId, userId } = await getOrCreatePlan(input.weekDate);

    const prepChecklist = PREP_KEYS.filter((k) => input.prepChecklist.includes(k));

    const { error: updateErr } = await supabase
      .from('weekly_plans')
      .update({ reflection: input.reflection, prep_checklist: prepChecklist })
      .eq('id', planId)
      .eq('user_id', userId);
    if (updateErr) return { ok: false, error: updateErr.message };

    const { error: deleteErr } = await supabase
      .from('weekly_priorities')
      .delete()
      .eq('weekly_plan_id', planId)
      .eq('user_id', userId);
    if (deleteErr) return { ok: false, error: deleteErr.message };

    const rows = input.priorities
      .map((p) => p.text.trim())
      .filter((t) => t.length > 0)
      .map((text, i) => ({
        user_id: userId,
        weekly_plan_id: planId,
        position: i + 1,
        text,
      }));

    if (rows.length > 0) {
      const { error: insertErr } = await supabase.from('weekly_priorities').insert(rows);
      if (insertErr) return { ok: false, error: insertErr.message };
    }

    revalidatePath('/week');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
