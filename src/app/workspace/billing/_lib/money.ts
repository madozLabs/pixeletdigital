import { formatCurrency } from "@/shared/format";

export function formatXof(cents: number): string {
  return formatCurrency(cents);
}
