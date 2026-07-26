const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

const XOF_FORMATTER = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "XOF",
  maximumFractionDigits: 0,
});

export function formatDate(date: Date): string {
  return DATE_FORMATTER.format(date);
}

export function formatShortDate(date: Date): string {
  return SHORT_DATE_FORMATTER.format(date);
}

export function formatDateTime(date: Date): string {
  return DATE_TIME_FORMATTER.format(date);
}

export function formatCurrency(minorUnits: number, currency = "XOF"): string {
  if (currency === "XOF") return XOF_FORMATTER.format(minorUnits / 100);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
}
