export const REPORT_GRANULARITIES = ["day", "week", "month", "year"] as const;
export type ReportGranularity = (typeof REPORT_GRANULARITIES)[number];

export function isReportGranularity(
  value: string,
): value is ReportGranularity {
  return (REPORT_GRANULARITIES as readonly string[]).includes(value);
}

export type PeriodBucket = Readonly<{
  start: Date;
  end: Date;
  label: string;
}>;

const MONTH_LABELS = [
  "Janv.",
  "Févr.",
  "Mars",
  "Avr.",
  "Mai",
  "Juin",
  "Juil.",
  "Août",
  "Sept.",
  "Oct.",
  "Nov.",
  "Déc.",
] as const;

function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// ISO-style week: Monday is day 1, Sunday is day 7.
function startOfWeekUtc(date: Date): Date {
  const day = startOfDayUtc(date);
  const isoWeekday = day.getUTCDay() === 0 ? 7 : day.getUTCDay();
  day.setUTCDate(day.getUTCDate() - (isoWeekday - 1));
  return day;
}

function startOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfYearUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

function step(start: Date, granularity: ReportGranularity): Date {
  const next = new Date(start);
  if (granularity === "day") next.setUTCDate(next.getUTCDate() + 1);
  else if (granularity === "week") next.setUTCDate(next.getUTCDate() + 7);
  else if (granularity === "month") next.setUTCMonth(next.getUTCMonth() + 1);
  else next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
}

function bucketStart(date: Date, granularity: ReportGranularity): Date {
  if (granularity === "day") return startOfDayUtc(date);
  if (granularity === "week") return startOfWeekUtc(date);
  if (granularity === "month") return startOfMonthUtc(date);
  return startOfYearUtc(date);
}

function labelFor(start: Date, granularity: ReportGranularity): string {
  const day = String(start.getUTCDate()).padStart(2, "0");
  const month = MONTH_LABELS[start.getUTCMonth()];
  const year = start.getUTCFullYear();
  if (granularity === "day") return `${day}/${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  if (granularity === "week") return `Sem. du ${day}/${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  if (granularity === "month") return `${month} ${year}`;
  return String(year);
}

// Builds a contiguous run of buckets covering [from, to] with no gaps, so a
// period with zero activity still renders as a zero bar rather than
// disappearing from the time axis -- an empty period is data too.
export function buildPeriodBuckets(
  from: Date,
  to: Date,
  granularity: ReportGranularity,
): readonly PeriodBucket[] {
  if (to.getTime() < from.getTime()) return [];

  const buckets: PeriodBucket[] = [];
  let cursor = bucketStart(from, granularity);
  const MAX_BUCKETS = 500;
  while (cursor.getTime() <= to.getTime() && buckets.length < MAX_BUCKETS) {
    const end = step(cursor, granularity);
    buckets.push({ start: cursor, end, label: labelFor(cursor, granularity) });
    cursor = end;
  }
  return buckets;
}

// Finds the bucket a given date falls into (linear scan -- bucket counts are
// bounded by MAX_BUCKETS above, never large enough to need a binary search).
export function findBucketIndex(
  buckets: readonly PeriodBucket[],
  date: Date,
): number {
  const time = date.getTime();
  return buckets.findIndex(
    (bucket) => time >= bucket.start.getTime() && time < bucket.end.getTime(),
  );
}
