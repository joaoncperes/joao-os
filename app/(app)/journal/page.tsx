import { createClient } from '@/lib/supabase/server';
import { todayInTz, addDays } from '@/lib/date';
import { JournalClient, type JournalRow, type PastRow } from './journal-client';

export const metadata = { title: 'Journal — João OS' };

// Re-render on every request so ?date= navigation always reflects fresh data.
export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
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

  // The (validated) date being viewed/edited — defaults to today, never future.
  const rawDate = (await searchParams).date;
  const viewDate =
    rawDate && DATE_RE.test(rawDate) && rawDate <= today ? rawDate : today;
  const isToday = viewDate === today;

  const { data: entry } = await supabase
    .from('journals')
    .select('*')
    .eq('user_id', user.id)
    .eq('journal_date', viewDate)
    .maybeSingle();

  const { data: past } = await supabase
    .from('journals')
    .select(
      'id, journal_date, win, area_pro_score, area_health_score, area_family_score, area_marriage_score, is_partial',
    )
    .eq('user_id', user.id)
    .order('journal_date', { ascending: false })
    .limit(14);

  // Streak: consecutive days ending today (or yesterday if today not yet logged)
  // where an entry exists. Look back 60 days. Anchored to today, not viewDate.
  const sixtyAgo = addDays(today, -60);
  const { data: streakRows } = await supabase
    .from('journals')
    .select('journal_date')
    .eq('user_id', user.id)
    .gte('journal_date', sixtyAgo)
    .order('journal_date', { ascending: false });
  const dateSet = new Set((streakRows ?? []).map((r) => r.journal_date));
  let streak = 0;
  let cursor = today;
  if (!dateSet.has(cursor)) cursor = addDays(cursor, -1);
  while (dateSet.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  return (
    <JournalClient
      key={viewDate}
      viewDate={viewDate}
      todayDate={today}
      isToday={isToday}
      entry={(entry as JournalRow | null) ?? null}
      past={(past ?? []) as PastRow[]}
      streak={streak}
    />
  );
}
