import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

// Shared by the shell's pending badge and Today's priorities, per request only.
export const readWeeklyPlan = cache(async (userId: string, weekStart: string) => {
  const supabase = await createClient();
  return supabase
    .from('weekly_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('week_start_date', weekStart)
    .maybeSingle();
});
