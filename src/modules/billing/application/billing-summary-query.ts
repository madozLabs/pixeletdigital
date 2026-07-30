import type { RequestContext } from "@/shared/request-context";
import {
  hasWorldScope,
  mayAccessBilling,
  requireActiveActor,
} from "./billing-authorization";

export type BillingAttachmentDto = Readonly<{
  id: string;
  fileName: string;
  publicUrl: string;
  sizeBytes: number;
  createdAt: Date;
}>;

export type BillingSummaryDto = Readonly<{
  clients: readonly Readonly<{ id: string; name: string }>[];
  quotes: readonly Readonly<{
    id: string;
    number: string;
    clientId: string;
    clientName: string;
    status: string;
    version: number;
    lineCount: number;
    totalCents: number;
    discountCents: number;
    taxRateBps: number;
    notes: string | null;
    validUntil: Date | null;
    canConvert: boolean;
    attachments: readonly BillingAttachmentDto[];
    lines: readonly Readonly<{
      label: string;
      quantity: number;
      unitPriceCents: number;
    }>[];
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
    attachments: readonly BillingAttachmentDto[];
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

export type BillingSummaryFilters = Readonly<{
  clientId?: string | null;
  status?: string | null;
  from?: Date | null;
  to?: Date | null;
}>;

export interface BillingSummaryReader {
  list(
    input: BillingSummaryFilters & {
      worldKey: string;
      skip: number;
      take: number;
    },
  ): Promise<BillingSummaryDto>;
}

export async function listBillingSummary(
  dependencies: Readonly<{ billingSummaryReader: BillingSummaryReader }>,
  context: RequestContext,
  input: BillingSummaryFilters &
    Readonly<{ worldKey: string; skip: number; take: number }>,
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
