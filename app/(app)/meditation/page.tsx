import { createClient } from '@/lib/supabase/server';
import { dowInTz, addDays, todayInTz } from '@/lib/date';
import {
  MeditationClient,
  type DayTab,
  type MeditationLogRow,
} from './meditation-client';

export const metadata = { title: 'Meditation — Pedro OS' };

const SHORT_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

type RawLog = {
  id: string;
  log_date: string;
  day_of_week: number;
  minutes: number;
};

export default async function MeditationPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { day: dayParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: u } = await supabase
    .from('users')
    .select('time_zone')
    .eq('id', user.id)
    .maybeSingle();
  const tz = u?.time_zone ?? 'America/Sao_Paulo';
  const today = todayInTz(tz);
  const todayDow = dowInTz(tz);
  const day =
    dayParam != null && /^[0-6]$/.test(dayParam) ? Number(dayParam) : todayDow;

  // Sunday-anchored week dates (0..6, Sun..Sat) — same convention as /workout.
  const weekStart = addDays(today, -todayDow);
  const dayTabs: DayTab[] = Array.from({ length: 7 }, (_, dow) => {
    const date = addDays(weekStart, dow);
    return {
      value: String(dow),
      shortName: SHORT_DAY[dow],
      date,
      dateNumber: Number(date.slice(8, 10)),
      isToday: dow === todayDow,
    };
  });

  // Single-user app: pull all logs ever and derive everything client-side
  // in the server component. Negligible volume (≤365 rows/year).
  const { data: allLogsRaw } = await supabase
    .from('meditation_logs')
    .select('id, log_date, day_of_week, minutes')
    .eq('user_id', user.id)
    .order('log_date', { ascending: false })
    .returns<RawLog[]>();
  const allLogs = allLogsRaw ?? [];

  // Rows for the selected DOW — last 12.
  const dowLogs = allLogs.filter((l) => l.day_of_week === day).slice(0, 12);
  const logs: MeditationLogRow[] = dowLogs.map((l) => ({
    id: l.id,
    date: l.log_date,
    minutes: l.minutes,
  }));

  // ----- Stats -----

  const totalSessions = allLogs.filter((l) => l.minutes > 0).length;

  // Map log_date → minutes for O(1) lookup.
  const minutesByDate = new Map<string, number>();
  for (const l of allLogs) minutesByDate.set(l.log_date, l.minutes);

  // Current streak: consecutive days (walking back from today) with minutes > 0.
  // Allow today to be missing (streak starts yesterday) so the streak doesn't
  // visually break before evening logging.
  let currentStreak = 0;
  {
    let cursor = today;
    if ((minutesByDate.get(cursor) ?? 0) === 0) cursor = addDays(cursor, -1);
    while ((minutesByDate.get(cursor) ?? 0) > 0) {
      currentStreak += 1;
      cursor = addDays(cursor, -1);
    }
  }

  // Week total (last 7 days including today).
  let weekTotalMinutes = 0;
  for (let i = 0; i < 7; i += 1) {
    weekTotalMinutes += minutesByDate.get(addDays(today, -i)) ?? 0;
  }

  // 30-day average across days with minutes logged (>0).
  let sum30 = 0;
  let count30 = 0;
  for (let i = 0; i < 30; i += 1) {
    const m = minutesByDate.get(addDays(today, -i)) ?? 0;
    if (m > 0) {
      sum30 += m;
      count30 += 1;
    }
  }
  const averageMinutes = count30 > 0 ? Math.round(sum30 / count30) : 0;

  return (
    <MeditationClient
      day={day}
      todayDow={todayDow}
      today={today}
      dayTabs={dayTabs}
      fullDayName={FULL_DAY[day]}
      logs={logs}
      stats={{
        currentStreak,
        weekTotalMinutes,
        averageMinutes,
        totalSessions,
      }}
    />
  );
}
