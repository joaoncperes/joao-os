/** Completion remains the existing binary checkbox, including counter habits. */
export function needsHabitRecovery(
  habit: { completed_at: string | null; missed_yesterday?: boolean },
  isToday: boolean,
): boolean {
  return isToday && habit.missed_yesterday === true && habit.completed_at == null;
}
