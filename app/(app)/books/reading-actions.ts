'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: string };

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Faça login de novo.');
  return { supabase, userId: user.id };
}

export async function logReading(input: {
  date: string;
  minutes: number;
  bookId: string | null;
}): Promise<Result> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { ok: false, error: 'Data inválida.' };
    const minutes = Math.round(input.minutes);
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) {
      return { ok: false, error: 'Minutos precisam estar entre 1 e 1440.' };
    }
    const { supabase, userId } = await ctx();
    const { error } = await supabase.from('reading_sessions').insert({
      user_id: userId,
      session_date: input.date,
      minutes,
      book_id: input.bookId,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath('/books');
    revalidatePath('/metas');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteReading(id: string): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const { error } = await supabase
      .from('reading_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/books');
    revalidatePath('/metas');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
