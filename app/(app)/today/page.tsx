import { requireAuth } from '@/lib/auth-gate';
import { createClient } from '@/lib/supabase/server';
import { todayInTz, sundayWeekStart } from '@/lib/date';
import { readRandomQuote } from '@/lib/random-quote';
import { readWeeklyPlan } from '@/lib/weekly-plan';
import type { WeekPriorityLite } from '@/components/week-priorities-card';
import type {
  Book,
  TodayHabit,
  TodayTask,
} from '@/lib/supabase/types';
import { TodayView } from './today-view';

type ReadingBook = Pick<
  Book,
  'id' | 'title' | 'author' | 'why' | 'categories' | 'started_at'
>;

export const metadata = { title: 'Today — João OS' };

// Force the route to re-render on every request so the quote rotates and the
// ?date= navigation always reflects fresh data.
export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { userId, timeZone: tz } = await requireAuth('complete');
  const supabase = await createClient();

  // The user's TZ-correct "today", plus the (validated) date being viewed.
  const todayStr = todayInTz(tz);

  const rawDate = (await searchParams).date;
  const viewDate =
    rawDate && DATE_RE.test(rawDate) && rawDate <= todayStr ? rawDate : todayStr;
  const isToday = viewDate === todayStr;

  // Habits for the viewed date: the live view for today, the date-parameterized
  // RPC for a past day. Both return the TodayHabit shape.
  const habitsRes = isToday
    ? await supabase
        .from('v_today_habits')
        .select('*')
        .eq('user_id', userId)
        .order('time_slot', { ascending: true, nullsFirst: false })
        .order('sort_order', { ascending: true })
    : await supabase.rpc('habits_for_date', { target_date: viewDate });

  if (habitsRes.error) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Today</h1>
        <p className="text-destructive text-sm">
          Could not load habits: {habitsRes.error.message}
        </p>
      </div>
    );
  }

  const habits = (habitsRes.data ?? []) as TodayHabit[];

  // Past-day view is habits-only; skip everything that is "now"-flavored.
  if (!isToday) {
    return (
      <TodayView
        userId={userId}
        key={`${viewDate}:${isToday}`}
        timeZone={tz}
        initialHabits={habits}
        initialTasks={[]}
        viewDate={viewDate}
        isToday={false}
        todayQuote={null}
        weekPriorities={[]}
        readingBooks={[]}
      />
    );
  }

  // ---- Today only: tasks, quote, week priorities, currently-reading ----
  // This week's priorities (Sunday-anchored, same as /week) for the reminder card.
  const weekStart = sundayWeekStart(todayStr);

  const [{ data: tasksData }, todayQuote, { data: readingRows }, { data: planRow }] = await Promise.all([
    supabase
      .from('v_today_tasks')
      .select('*')
      .eq('user_id', userId),
    readRandomQuote(supabase),
    supabase
      .from('books')
      .select('id, title, author, why, categories, started_at')
      .eq('user_id', userId)
      .eq('priority', 'lendo')
      .order('updated_at', { ascending: false })
      .limit(4),
    readWeeklyPlan(userId, weekStart),
  ]);

  const { data: priorityRows } = planRow
    ? await supabase
        .from('weekly_priorities')
        .select('id, position, text')
        .eq('weekly_plan_id', planRow.id)
        .order('position', { ascending: true })
    : { data: [] as WeekPriorityLite[] };

  const weekPriorities = (priorityRows ?? []) as WeekPriorityLite[];
  const readingBooks = (readingRows ?? []) as ReadingBook[];
  const tasks = (tasksData ?? []) as TodayTask[];

  return (
    <TodayView
      userId={userId}
      key={`${viewDate}:${isToday}`}
      timeZone={tz}
      initialHabits={habits}
      initialTasks={tasks}
      viewDate={viewDate}
      isToday
      todayQuote={todayQuote}
      weekPriorities={weekPriorities}
      readingBooks={readingBooks}
    />
  );
}
