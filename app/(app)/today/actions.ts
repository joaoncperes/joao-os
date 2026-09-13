'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

interface Input {
  habitId: string;
  date: string; // 'YYYY-MM-DD' in user's TZ
  complete: boolean;
}

export async function toggleHabitLog(input: Input): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const { error } = await supabase.from('habit_logs').upsert(
    {
      user_id: user.id,
      habit_id: input.habitId,
      log_date: input.date,
      completed_at: input.complete ? new Date().toISOString() : null,
    },
    { onConflict: 'habit_id,log_date' },
  );

  if (error) return { error: error.message };

  // Preserve router invalidation: Insights also renders these logs on the
  // server, and returning there after an edit must show the updated history.
  revalidatePath('/today');
  return { ok: true };
}
