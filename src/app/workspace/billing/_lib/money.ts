import { formatCurrency } from "@/shared/format";

export function formatXof(cents: number): string {
  return formatCurrency(cents);
}

// French number formatting (typed by hand, not always caught by
// type="number" input restrictions on every browser/OS/keyboard) uses a
// space or a non-breaking space as the thousands separator and a comma as
// the decimal separator -- e.g. "62 000" or "62000,00". A bare Number()
// silently returns NaN on either, which the old parser then turned into
// a silent 0 with no error shown: a real invoice line got created with a
// 0 price this way even though a large payment was recorded against it
// afterward. Strip the separators before parsing instead of trusting the
// browser to normalize them.
export function xofToCents(value: FormDataEntryValue | null): number {
  const raw = String(value ?? "")
    .trim()
    .replace(/[\s ]/g, "")
    .replace(",", ".");
  const amount = Number(raw);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
}
