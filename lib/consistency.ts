import { addDays, dateInTz } from './date';

export interface ConsistencyHabit {
  id: string;
  created_at: string;
  archived: boolean;
  firstLogDate: string | null;
}

export interface ConsistencyLog {
  habit_id: string;
  log_date: string;
  completed_at: string | null;
}

export interface ConsistencyScore {
  completed: number;
  opportunities: number;
  index: number | null;
}

export interface ConsistencyPoint {
  date: string;
  seven: ConsistencyScore;
  thirty: ConsistencyScore;
}

export function consistencyGrade(index: number | null) {
  if (index === null) return 'empty';
  if (index > 0.9) return 'darkGreen';
  if (index > 0.8) return 'green';
  if (index > 0.7) return 'yellow';
  if (index > 0.6) return 'orange';
  return 'red';
}

/** Weighted rolling ratios, including each endpoint and 29 warm-up days. */
export function calculateConsistency(
  habits: ConsistencyHabit[],
  logs: ConsistencyLog[],
  endDate: string,
  days: number,
  timeZone: string,
): ConsistencyPoint[] {
  const firstDate = addDays(endDate, -(days - 1));
  const start = addDays(firstDate, -29);
  const active = habits.filter((habit) => !habit.archived).map((habit) => {
    const created = dateInTz(habit.created_at, timeZone);
    return { id: habit.id, start: habit.firstLogDate && habit.firstLogDate < created ? habit.firstLogDate : created };
  });
  const done = new Set(logs.filter((log) => log.completed_at !== null)
    .map((log) => `${log.habit_id}:${log.log_date}`));
  const completed = [0];
  const opportunities = [0];
  const result: ConsistencyPoint[] = [];
  for (let date = start; date <= endDate; date = addDays(date, 1)) {
    let total = 0;
    let count = 0;
    for (const habit of active) {
      if (habit.start > date) continue;
      total++;
      if (done.has(`${habit.id}:${date}`)) count++;
    }
    completed.push(completed[completed.length - 1] + count);
    opportunities.push(opportunities[opportunities.length - 1] + total);
    if (date < firstDate) continue;
    const score = (window: number): ConsistencyScore => {
      const end = completed.length - 1;
      const from = Math.max(0, end - window);
      const numerator = completed[end] - completed[from];
      const denominator = opportunities[end] - opportunities[from];
      return { completed: numerator, opportunities: denominator, index: denominator === 0 ? null : numerator / denominator };
    };
    result.push({ date, seven: score(7), thirty: score(30) });
  }
  return result;
}
