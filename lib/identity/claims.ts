// Identity claims — deterministic "You are…" statements derived from logged data.
//
// Why: brain principle "Discipline as identity, not chore." Every Today
// open should reinforce who Pedro is becoming, drawn from his own behavior, not
// a generic motivational copy deck.
//
// Honesty rule: a claim only renders if the evidence threshold is met. Below
// threshold, the claim is dropped (the IdentityCard falls back to the value
// alone). The app must not invent percentages it can't substantiate.

import { addDays } from '@/lib/date';
import type { Area } from '@/lib/supabase/types';

export interface Claim {
  id: string;          // stable identifier; used for rotation + dedup
  statement: string;   // "You are…" header
  evidence: string;    // e.g., "92% of the last 90 days (28/30)"
  area: Area;
}

interface InputHabit {
  id: string;
  name: string;
  area: Area;
}

interface InputLog {
  habit_id: string;
  log_date: string;       // 'YYYY-MM-DD'
  completed_at: string | null;
}

interface InputJournal {
  journal_date: string;
  gabi_call_depth: number | null;
}

export interface ClaimsInput {
  habits: InputHabit[];
  habitLogs: InputLog[];
  todayInTz: string;       // 'YYYY-MM-DD'
  journals?: InputJournal[];
}

interface Adherence {
  area: Area;
  completed: number;
  total: number;
  pct: number;
}

function adherence(
  habits: InputHabit[],
  habitLogs: InputLog[],
  todayInTz: string,
  habitName: string,
  lookbackDays: number,
): Adherence | null {
  const habit = habits.find((h) => h.name === habitName);
  if (!habit) return null;

  const startDate = addDays(todayInTz, -(lookbackDays - 1));
  const completed = habitLogs.filter(
    (l) =>
      l.habit_id === habit.id &&
      l.completed_at != null &&
      l.log_date >= startDate &&
      l.log_date <= todayInTz,
  ).length;

  const total = lookbackDays;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { area: habit.area, completed, total, pct };
}

// Build claims from the input. Order is stable for deterministic rotation.
// Each claim has its own minimum-evidence gate so the early-data UX stays
// honest (no 100% from a sample of 1).
export function computeIdentityClaims(input: ClaimsInput): Claim[] {
  const { habits, habitLogs, todayInTz, journals } = input;
  const claims: Claim[] = [];

  // Wake — the headline identity claim. Tied to value #2 ("Discipline as identity").
  const wake = adherence(habits, habitLogs, todayInTz, 'Wake up before 6am', 90);
  if (wake && wake.completed >= 14) {
    claims.push({
      id: 'wake',
      statement: 'You wake before 6am',
      evidence: `${wake.pct}% of the last 90 days (${wake.completed}/${wake.total})`,
      area: wake.area,
    });
  }

  // Sleep — the matching evening discipline. Two-week window.
  const sleep = adherence(habits, habitLogs, todayInTz, 'Sleep before 22:30', 14);
  if (sleep && sleep.completed >= 7) {
    claims.push({
      id: 'sleep',
      statement: 'You honor the 22:30 lights-out',
      evidence: `${sleep.completed} of last ${sleep.total} nights`,
      area: sleep.area,
    });
  }

  // Train — daily, value #5 ("Train for sanity, not vanity").
  const train = adherence(habits, habitLogs, todayInTz, 'Train', 30);
  if (train && train.completed >= 14) {
    claims.push({
      id: 'train',
      statement: 'You train for sanity, not vanity',
      evidence: `${train.completed} of last ${train.total} days`,
      area: train.area,
    });
  }

  // Meditation — anchor for the morning chain.
  const meditation = adherence(habits, habitLogs, todayInTz, 'Meditation', 30);
  if (meditation && meditation.completed >= 14) {
    claims.push({
      id: 'meditation',
      statement: 'You meditate before doing',
      evidence: `${meditation.completed} of last ${meditation.total} mornings`,
      area: meditation.area,
    });
  }

  // Studies — value #6 ("Apply in D0 or do not read"). Loose proxy: study-window adherence.
  const study = adherence(habits, habitLogs, todayInTz, 'Studies / Reading (2h)', 30);
  if (study && study.completed >= 14) {
    claims.push({
      id: 'study',
      statement: 'You hold the morning study window',
      evidence: `${study.completed} of last ${study.total} mornings`,
      area: study.area,
    });
  }

  // Journaling — Cross-cutting. The OS only works when Pedro feeds it.
  const journal = adherence(habits, habitLogs, todayInTz, 'Journaling', 30);
  if (journal && journal.completed >= 14) {
    claims.push({
      id: 'journaling',
      statement: 'You journal honestly',
      evidence: `${journal.completed} of last ${journal.total} days logged`,
      area: journal.area,
    });
  }

  // Partner — value #7. Pull both habit adherence and depth from journals.
  const gabi = adherence(habits, habitLogs, todayInTz, 'Call partner', 14);
  if (gabi && gabi.completed >= 7) {
    let depthSuffix = '';
    if (journals && journals.length > 0) {
      const start = addDays(todayInTz, -13);
      const recent = journals.filter(
        (j) =>
          j.journal_date >= start &&
          j.journal_date <= todayInTz &&
          j.gabi_call_depth != null,
      );
      if (recent.length >= 5) {
        const avg =
          recent.reduce((acc, j) => acc + (j.gabi_call_depth ?? 0), 0) / recent.length;
        depthSuffix = `, depth ${avg.toFixed(1)}/3`;
      }
    }
    claims.push({
      id: 'gabi',
      statement: 'Best-friend status with Partner is your highest standard',
      evidence: `${gabi.completed} of last ${gabi.total} days called${depthSuffix}`,
      area: gabi.area,
    });
  }

  // Water — health discipline.
  const water = adherence(habits, habitLogs, todayInTz, 'Drink +3L water', 30);
  if (water && water.completed >= 14) {
    claims.push({
      id: 'water',
      statement: 'You hit 3L water daily',
      evidence: `${water.pct}% of last ${water.total} days (${water.completed} of ${water.total})`,
      area: water.area,
    });
  }

  return claims;
}

// Day-of-year (1..366) used for deterministic rotation.
export function dayOfYear(dateISO: string): number {
  const d = new Date(`${dateISO}T00:00:00Z`);
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((d.getTime() - start) / 86400000);
}

// Pick today's claim deterministically (same day → same claim).
export function pickClaimForDay(claims: Claim[], dateISO: string): Claim | null {
  if (claims.length === 0) return null;
  return claims[dayOfYear(dateISO) % claims.length];
}
