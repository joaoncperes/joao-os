import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';

export const DEFAULT_TZ = 'America/Sao_Paulo';

/** ISO date (YYYY-MM-DD) for "today" in the given time zone. */
export function todayInTz(tz: string = DEFAULT_TZ): string {
  return formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
}

/** ISO date (YYYY-MM-DD) for a given instant, in the given time zone. */
export function dateInTz(instantISO: string, tz: string = DEFAULT_TZ): string {
  return formatInTimeZone(new Date(instantISO), tz, 'yyyy-MM-dd');
}

/** Format an HH:MM:SS time string from the DB into a friendlier label, e.g. "06:00". */
export function formatTimeSlot(timeSlot: string | null): string {
  if (!timeSlot) return '';
  // PostgREST returns 'HH:MM:SS'.
  return timeSlot.slice(0, 5);
}

/** Human-readable date header: "Saturday, May 2". */
export function formatDateHeader(dateISO: string, tz: string = DEFAULT_TZ): string {
  const zoned = toZonedTime(new Date(`${dateISO}T12:00:00Z`), tz);
  return format(zoned, 'EEEE, MMMM d');
}

/** 0..6 (Sun..Sat). Matches Postgres dow + workout_split.day_of_week. */
export function dowInTz(tz: string = DEFAULT_TZ): number {
  const iso = Number(formatInTimeZone(new Date(), tz, 'i')); // 1..7 (Mon..Sun)
  return iso === 7 ? 0 : iso;
}

/** Add N days to a 'YYYY-MM-DD' (UTC arithmetic, calendar-safe). */
export function addDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ISO week info for 'YYYY-MM-DD'. Monday-anchored. */
export function isoWeekInfo(dateISO: string): {
  isoYear: number;
  isoWeek: number;
  weekStart: string; // Monday, YYYY-MM-DD
} {
  const d = new Date(`${dateISO}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7; // 0 = Mon
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - day);
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const isoYear = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day);
  const isoWeek = Math.round((+thursday - +week1Monday) / (7 * 86400000)) + 1;
  return { isoYear, isoWeek, weekStart: monday.toISOString().slice(0, 10) };
}

/** Sunday-anchored week start (YYYY-MM-DD) for a date. getUTCDay: 0=Sun..6=Sat. */
export function sundayWeekStart(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  return addDays(dateISO, -d.getUTCDay());
}
