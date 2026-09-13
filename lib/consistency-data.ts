import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays, todayInTz, DEFAULT_TZ } from './date';
import { calculateConsistency, type ConsistencyHabit, type ConsistencyLog } from './consistency';

/** Continue until an empty page, even when the server caps below our page size. */
export async function readAllPages<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error } = await read(rows.length, rows.length + 999);
    if (error) throw new Error('Não foi possível carregar o Consistency Index.');
    if (!data?.length) return rows;
    rows.push(...data);
  }
}

export async function readConsistency(supabase: SupabaseClient, days: number) {
  if (![1, 30, 90, 365].includes(days)) throw new Error('Período inválido.');
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Entre na sua conta para ver o índice.');
  const { data: profile, error: profileError } = await supabase.from('users')
    .select('time_zone').eq('id', user.id).maybeSingle();
  if (profileError) throw new Error('Não foi possível carregar o fuso da conta.');
  const timeZone = profile?.time_zone ?? DEFAULT_TZ;
  const today = todayInTz(timeZone);
  const start = addDays(today, -(days - 1) - 29);
  const habits = await readAllPages<Omit<ConsistencyHabit, 'firstLogDate'>>((from, to) => supabase
    .from('habits').select('id, created_at, archived').eq('user_id', user.id)
    .eq('archived', false).order('id').range(from, to));

  // The global first log may predate created_at (imports) and the chart window.
  const [withStarts, logs] = await Promise.all([
    Promise.all(habits.map(async (habit): Promise<ConsistencyHabit> => {
      const { data, error } = await supabase.from('habit_logs').select('log_date')
        .eq('user_id', user.id).eq('habit_id', habit.id).lte('log_date', today)
        .order('log_date').limit(1).maybeSingle();
      if (error) throw new Error('Não foi possível carregar o início dos hábitos.');
      return { ...habit, firstLogDate: data?.log_date ?? null };
    })),
    habits.length ? readAllPages<ConsistencyLog>((from, to) => supabase.from('habit_logs')
      .select('habit_id, log_date, completed_at').eq('user_id', user.id)
      .gte('log_date', start).lte('log_date', today).not('completed_at', 'is', null)
      .order('log_date').order('id').range(from, to)) : Promise.resolve([]),
  ]);
  return { userId: user.id, points: calculateConsistency(withStarts, logs, today, days, timeZone) };
}
