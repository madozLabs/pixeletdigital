const FORMATTER = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "XOF",
  maximumFractionDigits: 0,
});

export function formatXof(cents: number): string {
  return FORMATTER.format(Math.round(cents / 100));
}

export function formatEuros(cents: number): string {
  return formatXof(cents);
}
