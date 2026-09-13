/**
 * Parse a user-entered decimal accepting both `.` and `,` as the
 * decimal separator. pt-BR mobile keyboards expose comma but Number()
 * only recognises period.
 */
export function parseDecimalInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const normalized = trimmed.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
