import type { RequestContext } from "@/shared/request-context";
import {
  hasWorldScope,
  mayAccessBilling,
  requireActiveActor,
} from "./billing-authorization";

export type BillingSummaryDto = Readonly<{
  clients: readonly Readonly<{ id: string; name: string }>[];
  quotes: readonly Readonly<{
    id: string;
    number: string;
    clientName: string;
    status: string;
    version: number;
    lineCount: number;
    totalCents: number;
    validUntil: Date | null;
    canConvert: boolean;
  }>[];
  totalQuotes: number;
  invoices: readonly Readonly<{
    id: string;
    number: string;
    clientName: string;
    status: string;
    version: number;
    totalCents: number;
    paidCents: number;
    balanceCents: number;
    dueAt: Date | null;
  }>[];
  totalInvoices: number;
  balances: readonly Readonly<{
    clientId: string;
    clientName: string;
    billedCents: number;
    paidCents: number;
    balanceCents: number;
  }>[];
  catalogue: readonly Readonly<{
    id: string;
    label: string;
    kind: string;
    unitPriceCents: number;
    version: number;
  }>[];
}>;

export interface BillingSummaryReader {
  list(input: {
    worldKey: string;
    skip: number;
    take: number;
  }): Promise<BillingSummaryDto>;
}

export async function listBillingSummary(
  dependencies: Readonly<{ billingSummaryReader: BillingSummaryReader }>,
  context: RequestContext,
  input: Readonly<{ worldKey: string; skip: number; take: number }>,
) {
  const actor = requireActiveActor(context);
  if (
    !actor.ok ||
    !mayAccessBilling(actor.value) ||
    !hasWorldScope(actor.value, input.worldKey)
  ) {
    return { ok: false as const, error: { code: "FORBIDDEN" as const } };
  }
  return {
    ok: true as const,
    value: await dependencies.billingSummaryReader.list(input),
  };
}
