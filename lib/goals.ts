// Metas do João OS — cálculo de progresso a partir dos registros.
// Funções puras (sem Supabase) para poder testar isoladamente.

export type GoalKind = 'weekly' | 'target';

export type GoalMetric =
  | 'workouts'
  | 'runs'
  | 'run_km'
  | 'reading_minutes'
  | 'books_finished'
  | 'exercise_max'
  | 'manual';

export interface Goal {
  id: string;
  title: string;
  kind: GoalKind;
  metric: GoalMetric;
  target_value: number;
  start_value: number | null;
  current_value: number | null;
  exercise_id: string | null;
  start_date: string; // YYYY-MM-DD
  due_date: string | null;
  position: number;
}

export interface ActivityData {
  /** Datas das sessões de musculação com pelo menos uma série registrada. */
  workoutDates: string[];
  runs: { date: string; km: number | null }[];
  reading: { date: string; minutes: number }[];
  /** Datas de término de livros lidos. */
  booksFinishedDates: string[];
  /** exercise_id → maior carga (kg) já registrada. */
  exerciseMax: Record<string, number>;
}

export const METRIC_META: Record<
  GoalMetric,
  { label: string; unit: string; weekly: boolean; target: boolean }
> = {
  workouts: { label: 'Treinos de musculação', unit: 'treinos', weekly: true, target: true },
  runs: { label: 'Corridas', unit: 'corridas', weekly: true, target: true },
  run_km: { label: 'Km corridos', unit: 'km', weekly: true, target: true },
  reading_minutes: { label: 'Minutos de leitura', unit: 'min', weekly: true, target: true },
  books_finished: { label: 'Livros terminados', unit: 'livros', weekly: false, target: true },
  exercise_max: { label: 'Carga num exercício', unit: 'kg', weekly: false, target: true },
  manual: { label: 'Outro (atualizo à mão)', unit: '', weekly: false, target: true },
};

/** Soma 'days' dias a uma data 'YYYY-MM-DD'. */
export function plusDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Segunda-feira da semana de 'dateISO'. */
export function mondayOf(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  const offset = (d.getUTCDay() + 6) % 7; // 0 = segunda
  return plusDays(dateISO, -offset);
}

function inRange(date: string, from: string, toInclusive: string): boolean {
  return date >= from && date <= toInclusive;
}

/** Valor acumulado de uma métrica entre duas datas (inclusive). */
export function metricValueBetween(
  metric: GoalMetric,
  data: ActivityData,
  from: string,
  to: string,
): number {
  switch (metric) {
    case 'workouts':
      return new Set(data.workoutDates.filter((d) => inRange(d, from, to))).size;
    case 'runs':
      return data.runs.filter((r) => inRange(r.date, from, to)).length;
    case 'run_km':
      return round1(
        data.runs
          .filter((r) => inRange(r.date, from, to))
          .reduce((s, r) => s + (r.km ?? 0), 0),
      );
    case 'reading_minutes':
      return data.reading
        .filter((r) => inRange(r.date, from, to))
        .reduce((s, r) => s + r.minutes, 0);
    case 'books_finished':
      return data.booksFinishedDates.filter((d) => inRange(d, from, to)).length;
    default:
      return 0;
  }
}

/** Progresso da semana que começa em 'weekStart' (segunda). */
export function weeklyValue(goal: Goal, data: ActivityData, weekStart: string): number {
  return metricValueBetween(goal.metric, data, weekStart, plusDays(weekStart, 6));
}

/** Valor atual de um objetivo de longo prazo. */
export function targetCurrent(goal: Goal, data: ActivityData, today: string): number {
  if (goal.metric === 'manual') return goal.current_value ?? goal.start_value ?? 0;
  if (goal.metric === 'exercise_max') {
    return goal.exercise_id ? data.exerciseMax[goal.exercise_id] ?? 0 : 0;
  }
  const end = goal.due_date && goal.due_date < today ? goal.due_date : today;
  return metricValueBetween(goal.metric, data, goal.start_date, end);
}

/** 0..1. Usa o valor inicial quando existe (ex.: supino saiu de 80 kg). */
export function progressRatio(current: number, target: number, start: number | null): number {
  const base = start != null && start < target ? start : 0;
  if (target <= base) return current >= target ? 1 : 0;
  return clamp01((current - base) / (target - base));
}

/** Semanas consecutivas batidas. A semana atual conta só se já foi batida. */
export function weeklyStreak(goal: Goal, data: ActivityData, currentWeekStart: string): number {
  let streak = 0;
  let week = currentWeekStart;
  if (weeklyValue(goal, data, week) >= goal.target_value) streak++;
  week = plusDays(week, -7);
  // Não conta semanas anteriores à criação da meta.
  const firstWeek = mondayOf(goal.start_date);
  while (week >= firstWeek && weeklyValue(goal, data, week) >= goal.target_value) {
    streak++;
    week = plusDays(week, -7);
  }
  return streak;
}

/** Dias corridos até o prazo (negativo = atrasado). */
export function daysUntil(today: string, due: string): number {
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${due}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "17–23 nov" ou "29 dez – 4 jan". */
export function formatWeekRange(weekStart: string): string {
  const end = plusDays(weekStart, 6);
  const [, m1, d1] = weekStart.split('-').map(Number);
  const [, m2, d2] = end.split('-').map(Number);
  if (m1 === m2) return `${d1}–${d2} ${MONTHS[m1 - 1]}`;
  return `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]}`;
}

/** "23 nov 2026" */
export function formatDatePt(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
