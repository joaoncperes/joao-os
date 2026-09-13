import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateConsistency, consistencyGrade, type ConsistencyHabit, type ConsistencyLog } from './consistency';
import { readAllPages, readConsistency } from './consistency-data';
import { addDays, todayInTz } from './date';

const tz = 'America/Sao_Paulo';
const end = '2026-09-08';
const habit = (id = 'a', created = '2026-01-01T12:00:00Z'): ConsistencyHabit => ({ id, created_at: created, archived: false, firstLogDate: null });
const log = (date: string, id = 'a', completed = true): ConsistencyLog => ({ habit_id: id, log_date: date, completed_at: completed ? `${date}T12:00:00Z` : null });
const score = (habits: ConsistencyHabit[], logs: ConsistencyLog[], days = 1) => calculateConsistency(habits, logs, end, days, tz);

async function main() {
  assert.deepEqual(score([habit()], [])[0].seven, { completed: 0, opportunities: 7, index: 0 });
  const all = Array.from({ length: 30 }, (_, i) => log(addDays(end, -i)));
  assert.equal(score([habit()], all)[0].seven.index, 1);
  assert.equal(score([habit()], all)[0].thirty.index, 1);
  assert.equal(score([habit()], [log(end)])[0].seven.index, 1 / 7);
  assert.equal(score([habit()], [log(addDays(end, -7))])[0].seven.completed, 0);
  assert.equal(score([habit()], [log(addDays(end, -29)), log(addDays(end, -30))])[0].thirty.completed, 1);
  assert.equal(score([habit()], [log(end, 'a', false)])[0].seven.index, 0);
  assert.equal(score([habit()], [log(end), log(end), log(end, 'foreign')])[0].seven.completed, 1);
  // Different daily denominators: 1/2 + 0/1 + … must be 1/8, not mean(50%,0%,…).
  assert.deepEqual(score([habit(), habit('new', `${end}T12:00:00Z`)], [log(end, 'new')])[0].seven, { completed: 1, opportunities: 8, index: 1 / 8 });
  assert.equal(score([{ ...habit(), archived: true }], all)[0].thirty.index, null);
  assert.equal(score([], [])[0].seven.index, null);
  assert.equal(score([habit('future', '2026-09-09T12:00:00Z')], [])[0].seven.index, null);
  // 01:00 UTC belongs to the prior calendar day in the account timezone.
  assert.equal(score([habit('a', '2026-09-08T01:00:00Z')], [])[0].seven.opportunities, 2);
  assert.equal(score([{ ...habit('a', `${end}T12:00:00Z`), firstLogDate: '2026-01-01' }], all)[0].thirty.opportunities, 30);
  const history = score([habit()], all, 90);
  assert.equal(history.length, 90);
  assert.equal(history[0].date, addDays(end, -89));
  assert.deepEqual(history.at(-1), score([habit()], all)[0]);
  const warmup = log(addDays(history[0].date, -29));
  assert.equal(score([habit()], [warmup], 90)[0].thirty.completed, 1);
  assert.equal(score([habit()], [warmup], 90)[0].seven.completed, 0);
  assert.equal(calculateConsistency([habit()], [], '2028-03-01', 3, tz)[1].date, '2028-02-29');
  assert.equal(consistencyGrade(null), 'empty');
  assert.equal(consistencyGrade(0), 'red');
  assert.equal(consistencyGrade(0.49), 'red');
  assert.equal(consistencyGrade(0.5), 'red');
  assert.equal(consistencyGrade(0.6), 'red');
  assert.equal(consistencyGrade(0.60001), 'orange');
  assert.equal(consistencyGrade(0.7), 'orange');
  assert.equal(consistencyGrade(0.70001), 'yellow');
  assert.equal(consistencyGrade(0.8), 'yellow');
  assert.equal(consistencyGrade(0.80001), 'green');
  assert.equal(consistencyGrade(0.9), 'green');
  assert.equal(consistencyGrade(0.90001), 'darkGreen');
  assert.equal(consistencyGrade(1), 'darkGreen');

  const source = Array.from({ length: 2405 }, (_, i) => i);
  const paged = await readAllPages<number>((from, to) => Promise.resolve({ data: source.slice(from, Math.min(to + 1, from + 400)), error: null }));
  assert.deepEqual(paged, source, 'Must honor a server cap smaller than requested size');
  await assert.rejects(() => readAllPages(() => Promise.resolve({ data: null, error: { message: 'offline' } })));

  // In-memory PostgREST double: intentionally no RLS, so missing user filters leak.
  const today = todayInTz(tz);
  const tables: Record<string, Record<string, unknown>[]> = {
    users: [{ id: 'me', time_zone: tz }, { id: 'other', time_zone: 'UTC' }],
    habits: [
      { ...habit('mine', `${today}T12:00:00Z`), user_id: 'me' },
      { ...habit('theirs'), user_id: 'other' },
    ],
    habit_logs: [
      { ...log(today, 'mine'), user_id: 'me', id: '1' },
      { ...log(today, 'theirs'), user_id: 'other', id: '2' },
      // An older uncompleted import establishes the start, too.
      { ...log(addDays(today, -50), 'mine', false), user_id: 'me', id: '3' },
    ],
  };
  let signedIn = true;
  const client = {
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'me' } : null }, error: null }) },
    from: (table: string) => {
      let rows = [...tables[table]];
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { rows = rows.filter((row) => row[key] === value); return query; },
        gte: (key: string, value: string) => { rows = rows.filter((row) => String(row[key]) >= value); return query; },
        lte: (key: string, value: string) => { rows = rows.filter((row) => String(row[key]) <= value); return query; },
        not: (key: string) => { rows = rows.filter((row) => row[key] !== null); return query; },
        order: (key: string) => { rows.sort((a, b) => String(a[key]).localeCompare(String(b[key]))); return query; },
        limit: (n: number) => { rows = rows.slice(0, n); return query; },
        range: (from: number, to: number) => Promise.resolve({ data: rows.slice(from, to + 1), error: null }),
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      };
      return query;
    },
  } as unknown as SupabaseClient;
  const loaded = await readConsistency(client, 1);
  assert.equal(loaded.userId, 'me');
  assert.deepEqual(loaded.points[0].seven, { completed: 1, opportunities: 7, index: 1 / 7 });
  assert.equal(loaded.points[0].thirty.opportunities, 30);
  assert.deepEqual((await readConsistency(client, 90)).points.at(-1), loaded.points[0]);
  // Re-reading after a successful uncheck or archive reflects the new state.
  tables.habit_logs[0].completed_at = null;
  assert.equal((await readConsistency(client, 1)).points[0].seven.index, 0);
  tables.habits[0].archived = true;
  assert.equal((await readConsistency(client, 1)).points[0].seven.index, null);
  signedIn = false;
  await assert.rejects(() => readConsistency(client, 1), /Entre na sua conta/);
  await assert.rejects(() => readConsistency(client, 500), /Período inválido/);
  console.log('Consistency tests passed: ratios, windows, timezone, imports, grades, pagination, account isolation and edits.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
