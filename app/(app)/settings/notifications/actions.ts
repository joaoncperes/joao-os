'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

type ActionResult = { ok?: true; error?: string };

async function getUserId(): Promise<
  { supabase: Awaited<ReturnType<typeof createClient>>; userId: string } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };
  return { supabase, userId: user.id };
}

function normalizeTime(input: string): string | null {
  // Accept 'HH:MM' or 'HH:MM:SS'. Return canonical 'HH:MM:SS' or null on bad input.
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(input.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = m[3] ? Number(m[3]) : 0;
  if (hh > 23 || mm > 59 || ss > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function normalizeText(input: string): string | null {
  const t = input.trim();
  if (t.length < 1 || t.length > 140) return null;
  return t;
}

export async function createCustomReminder(input: {
  text: string;
  scheduled_time: string;
}): Promise<ActionResult & { id?: string }> {
  const ctx = await getUserId();
  if ('error' in ctx) return ctx;

  const text = normalizeText(input.text);
  if (!text) return { error: 'Text is required (1–140 chars).' };
  const time = normalizeTime(input.scheduled_time);
  if (!time) return { error: 'Invalid time.' };

  const { data, error } = await ctx.supabase
    .from('custom_reminders')
    .insert({
      user_id: ctx.userId,
      text,
      scheduled_time: time,
      enabled: true,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };
  revalidatePath('/settings/notifications');
  return { ok: true, id: data.id as string };
}

export async function updateCustomReminder(input: {
  id: string;
  text?: string;
  scheduled_time?: string;
  enabled?: boolean;
}): Promise<ActionResult> {
  const ctx = await getUserId();
  if ('error' in ctx) return ctx;

  const patch: Record<string, unknown> = {};
  if (input.text !== undefined) {
    const text = normalizeText(input.text);
    if (!text) return { error: 'Text is required (1–140 chars).' };
    patch.text = text;
  }
  if (input.scheduled_time !== undefined) {
    const time = normalizeTime(input.scheduled_time);
    if (!time) return { error: 'Invalid time.' };
    patch.scheduled_time = time;
  }
  if (input.enabled !== undefined) {
    patch.enabled = input.enabled;
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await ctx.supabase
    .from('custom_reminders')
    .update(patch)
    .eq('id', input.id)
    .eq('user_id', ctx.userId);

  if (error) return { error: error.message };
  revalidatePath('/settings/notifications');
  return { ok: true };
}

export async function deleteCustomReminder(input: { id: string }): Promise<ActionResult> {
  const ctx = await getUserId();
  if ('error' in ctx) return ctx;

  const { error } = await ctx.supabase
    .from('custom_reminders')
    .delete()
    .eq('id', input.id)
    .eq('user_id', ctx.userId);

  if (error) return { error: error.message };
  revalidatePath('/settings/notifications');
  return { ok: true };
}
