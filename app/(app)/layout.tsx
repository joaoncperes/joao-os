import type { ReactNode } from 'react';
import { BottomNav } from '@/components/bottom-nav';
import { CommandPalette } from '@/components/command-palette';
import { Sidebar } from '@/components/sidebar';
import { requireAuth } from '@/lib/auth-gate';
import { createClient } from '@/lib/supabase/server';
import { sundayWeekStart, todayInTz } from '@/lib/date';
import { readWeeklyPlan } from '@/lib/weekly-plan';

export default async function AppShellLayout({ children }: { children: ReactNode }) {
  const { userId, timeZone } = await requireAuth('complete');
  const supabase = await createClient();

  const today = todayInTz(timeZone);
  const todayDow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const weekStart = sundayWeekStart(today);

  const [
    { data: journalToday },
    { data: sessionToday },
    { data: splitToday },
    { data: weekPlan },
  ] = await Promise.all([
    supabase
      .from('journals')
      .select('id')
      .eq('user_id', userId)
      .eq('journal_date', today)
      .maybeSingle(),
    supabase
      .from('workout_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('session_date', today)
      .maybeSingle(),
    supabase
      .from('workout_split')
      .select('is_rest')
      .eq('user_id', userId)
      .eq('day_of_week', todayDow)
      .maybeSingle(),
    readWeeklyPlan(userId, weekStart),
  ]);

  const pendingJournal = journalToday == null;
  const pendingWorkout = sessionToday == null && !splitToday?.is_rest;
  const pendingWeek = weekPlan == null;

  return (
    <div className="bg-background flex min-h-screen flex-1">
      <Sidebar
        pendingJournal={pendingJournal}
        pendingWorkout={pendingWorkout}
        pendingWeek={pendingWeek}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-24 pt-[calc(env(safe-area-inset-top)+1.5rem)] sm:px-6 sm:pb-8 sm:pt-[calc(env(safe-area-inset-top)+2rem)] lg:px-14 lg:pb-20 lg:pt-[calc(env(safe-area-inset-top)+2.5rem)]">
          {children}
        </main>
        <div className="lg:hidden">
          <BottomNav
            pendingJournal={pendingJournal}
            pendingWorkout={pendingWorkout}
            pendingWeek={pendingWeek}
          />
        </div>
      </div>
      <CommandPalette />
    </div>
  );
}
