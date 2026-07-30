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

// Kept in this file rather than renaming week.ts -- these are used
// exclusively by the editorial calendar's month view, same as the rest of
// this module is used exclusively by its week view. Renaming would touch
// every existing import of week.ts for no behavioral change.
export function firstOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function addMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
}

export function parseMonthParam(
  value: string | undefined,
  fallback: Date,
): Date {
  if (!value) return firstOfMonth(fallback);
  const parsed = new Date(`${value}-01T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return firstOfMonth(fallback);
  return firstOfMonth(parsed);
}

export function formatMonthParam(date: Date): string {
  return formatISODate(date).slice(0, 7);
}

// Monday-start grid padded to full weeks (nulls for the leading/trailing
// days outside the month) -- padding cells render blank, no data is ever
// fetched for the adjacent months they'd represent.
export function monthGridDays(monthStart: Date): readonly (Date | null)[] {
  const firstWeekday =
    monthStart.getUTCDay() === 0 ? 7 : monthStart.getUTCDay();
  const leadingBlanks = firstWeekday - 1;
  const daysInMonth = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const cells: (Date | null)[] = [];
  for (let index = 0; index < leadingBlanks; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(
      new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), day)),
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
