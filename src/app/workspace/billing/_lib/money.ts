const FORMATTER = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export function formatEuros(cents: number): string {
  return FORMATTER.format(cents / 100);
}
