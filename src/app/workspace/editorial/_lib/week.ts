const DAY_MS = 24 * 60 * 60 * 1000;

export const WEEKDAY_LABELS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
] as const;

export function mondayOf(date: Date): Date {
  const truncated = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const isoWeekday = truncated.getUTCDay() === 0 ? 7 : truncated.getUTCDay();
  return new Date(truncated.getTime() - (isoWeekday - 1) * DAY_MS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function isSameDay(a: Date, b: Date): boolean {
  return formatISODate(a) === formatISODate(b);
}

export function parseISODate(value: string | undefined, fallback: Date): Date {
  if (!value) return mondayOf(fallback);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return mondayOf(fallback);
  return mondayOf(parsed);
}
