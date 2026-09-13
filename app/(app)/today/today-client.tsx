'use client';

import { Fragment, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { addDays, todayInTz } from '@/lib/date';
import { needsHabitRecovery } from '@/lib/habit-recovery';
import { cn } from '@/lib/utils';
import type {
  Book,
  QuoteWithAuthor,
  TodayHabit,
  TodayTask,
} from '@/lib/supabase/types';
import { WeekPrioritiesCard, type WeekPriorityLite } from '@/components/week-priorities-card';
import { CurrentlyReadingCard } from '@/components/currently-reading-card';
import { ConsistencyCard } from '@/components/consistency-card';
import { toggleHabitLog } from './actions';
import { TaskBuckets, type TodaySlotItem } from './task-buckets';
import { QuoteOfDay } from './quote-of-day';
import { HabitTaskRow } from './habit-task-row';

type ReadingBook = Pick<
  Book,
  'id' | 'title' | 'author' | 'why' | 'categories' | 'started_at'
>;

export interface TodayClientProps {
  userId: string;
  timeZone: string;
  initialHabits: TodayHabit[];
  initialTasks: TodayTask[];
  viewDate: string; // the date being shown/edited (YYYY-MM-DD)
  isToday: boolean;
  todayQuote: QuoteWithAuthor | null;
  weekPriorities: WeekPriorityLite[];
  readingBooks: ReadingBook[];
}

function greeting(hour: number) {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function TodayClient({
  userId,
  timeZone,
  initialHabits,
  initialTasks,
  viewDate,
  isToday,
  todayQuote,
  weekPriorities,
  readingBooks,
}: TodayClientProps) {
  const supabase = createClient();
  const qc = useQueryClient();
  const router = useRouter();
  const [dateChanged, setDateChanged] = useState(false);

  useEffect(() => {
    const checkDate = () => {
      if (isToday && todayInTz(timeZone) !== viewDate) {
        setDateChanged(true);
        router.refresh();
      } else if (document.visibilityState === 'visible') {
        void qc.invalidateQueries({ queryKey: ['habits', viewDate] });
      }
    };
    // Timers may be suspended in the PWA, so also check when it resumes.
    const timer = window.setInterval(checkDate, 30_000);
    document.addEventListener('visibilitychange', checkDate);
    window.addEventListener('focus', checkDate);
    checkDate();
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', checkDate);
      window.removeEventListener('focus', checkDate);
    };
  }, [isToday, timeZone, viewDate, router, qc]);

  const { data: habits = initialHabits } = useQuery({
    queryKey: ['habits', viewDate],
    queryFn: async () => {
      if (isToday && todayInTz(timeZone) === viewDate) {
        const { data, error } = await supabase
          .from('v_today_habits')
          .select('*')
          .order('time_slot', { ascending: true, nullsFirst: false })
          .order('sort_order', { ascending: true });
        if (error) throw error;
        const rows = (data ?? []) as TodayHabit[];
        // A request can cross midnight; never cache the new day under yesterday.
        if (rows.some((h) => h.today_in_tz !== viewDate) || todayInTz(timeZone) !== viewDate) {
          router.refresh();
          throw new Error('O dia mudou. Atualizando os hábitos…');
        }
        return rows;
      }
      const { data, error } = await supabase.rpc('habits_for_date', {
        target_date: viewDate,
      });
      if (error) throw error;
      return (data ?? []) as TodayHabit[];
    },
    initialData: initialHabits,
    staleTime: 30_000,
  });

  const habitCompleted = habits.filter((h) => h.completed_at != null).length;
  const habitTotal = habits.length;
  const pct = habitTotal === 0 ? 0 : Math.round((habitCompleted / habitTotal) * 100);

  const habitMutation = useMutation({
    mutationFn: async (input: { habitId: string; nowComplete: boolean }) => {
      const result = await toggleHabitLog({
        habitId: input.habitId,
        date: viewDate,
        complete: input.nowComplete,
      });
      if (result.error) throw new Error(result.error);
    },
    onMutate: async ({ habitId, nowComplete }) => {
      await qc.cancelQueries({ queryKey: ['habits', viewDate] });
      const prev = qc.getQueryData<TodayHabit[]>(['habits', viewDate]);
      if (prev) {
        qc.setQueryData<TodayHabit[]>(
          ['habits', viewDate],
          prev.map((h) =>
            h.habit_id === habitId
              ? { ...h, completed_at: nowComplete ? new Date().toISOString() : null }
              : h,
          ),
        );
      }
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['habits', viewDate], ctx.prev);
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    },
    onSettled: () => Promise.all([
      qc.invalidateQueries({ queryKey: ['habits'] }),
      qc.invalidateQueries({ queryKey: ['consistency', userId] }),
    ]),
  });

  // Habit rows are rendered here (they own their query + mutation), but handed
  // to TaskBuckets tagged with their sort keys so it can interleave them with
  // tasks chronologically instead of stacking them above.
  const habitItems: TodaySlotItem[] = habits.map((h) => ({
    id: h.habit_id,
    time: h.time_slot,
    order: h.sort_order,
    node: (
      <HabitTaskRow
        kind="habit"
        done={h.completed_at != null}
        time={h.time_slot}
        title={h.name}
        recoveryNeeded={needsHabitRecovery(h, isToday && !dateChanged)}
        disabled={habitMutation.isPending || dateChanged}
        onToggle={(nowComplete) => {
          if (isToday && todayInTz(timeZone) !== viewDate) {
            setDateChanged(true);
            router.refresh();
            return;
          }
          habitMutation.mutate({ habitId: h.habit_id, nowComplete });
        }}
      />
    ),
  }));

  // Same rows, for the habits-only past-day view below.
  const habitRows =
    habitItems.length > 0 ? (
      <div className="flex flex-col">
        {habitItems.map((i) => (
          <Fragment key={i.id}>{i.node}</Fragment>
        ))}
      </div>
    ) : null;

  // Format header date — Saturday, May 2 (with the day name in lighter weight)
  const headerDate = new Date(`${viewDate}T12:00:00Z`);
  const dayName = format(headerDate, 'EEEE');
  const monthDay = format(headerDate, 'MMMM d');
  const hour = new Date().getHours();

  const navBtn =
    'flex h-8 w-8 items-center justify-center rounded-md transition-colors';

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-[240px]">
          <div className="text-text-3 mb-1.5 text-[13px] font-medium uppercase tracking-[0.02em]">
            {isToday ? `${greeting(hour)}, Pedro` : 'Editando dia anterior'}
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              href={`/today?date=${addDays(viewDate, -1)}`}
              aria-label="Dia anterior"
              className={cn(navBtn, 'text-text-3 hover:bg-surface-2 hover:text-text')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-text text-[30px] font-semibold leading-[1.1] tracking-[-0.02em]">
              <span className="text-text-3 font-medium">{dayName},</span> {monthDay}
            </h1>
            {isToday ? (
              <span
                aria-disabled="true"
                className={cn(navBtn, 'text-text-4 cursor-not-allowed opacity-40')}
              >
                <ChevronRight className="h-4 w-4" />
              </span>
            ) : (
              <Link
                href={`/today?date=${addDays(viewDate, 1)}`}
                aria-label="Próximo dia"
                className={cn(navBtn, 'text-text-3 hover:bg-surface-2 hover:text-text')}
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
            {!isToday ? (
              <Link
                href="/today"
                className="text-text-2 border-border hover:bg-surface-2 hover:text-text ml-1 rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors"
              >
                Hoje
              </Link>
            ) : null}
          </div>
        </div>
        <div className="bg-surface border-border flex min-w-[260px] items-center gap-4 rounded-xl border px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <div className="text-text-3 text-[11.5px] font-medium uppercase tracking-[0.06em]">
              {isToday ? 'Today' : 'Esse dia'}
            </div>
            <div className="text-text text-[18px] font-semibold tabular-nums">
              {habitCompleted} <span className="text-text-4 font-medium">/ {habitTotal}</span>
            </div>
          </div>
          <div className="bg-surface-2 h-1.5 min-w-[100px] flex-1 overflow-hidden rounded-full">
            <div
              className="bg-accent h-full rounded-full transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-text-2 min-w-[32px] text-right text-xs font-semibold tabular-nums">
            {pct}%
          </div>
        </div>
      </header>

      {isToday ? (
        <>
          <ConsistencyCard userId={userId} today={viewDate} />

          <WeekPrioritiesCard priorities={weekPriorities} />

          <QuoteOfDay quote={todayQuote} />

          <CurrentlyReadingCard books={readingBooks} />

          <TaskBuckets initialTasks={initialTasks} todaySlotItems={habitItems} />
        </>
      ) : (
        <section className="bg-surface border-border overflow-hidden rounded-xl border">
          <div className="text-text-3 px-4 pb-2.5 pt-3.5 text-[11.5px] font-semibold uppercase tracking-[0.08em]">
            Hábitos
          </div>
          {habitRows ?? (
            <div className="border-border text-text-4 border-t px-3.5 py-3 text-[14px] italic">
              Nenhum hábito ativo.
            </div>
          )}
        </section>
      )}
    </div>
  );
}
