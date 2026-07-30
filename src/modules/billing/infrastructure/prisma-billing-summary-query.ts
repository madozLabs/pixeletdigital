import type { BillingAttachment, PrismaClient } from "@/generated/prisma/client";
import type {
  BillingAttachmentDto,
  BillingSummaryReader,
} from "../application/billing-summary-query";

function groupAttachments(
  attachments: readonly BillingAttachment[],
): Map<string, BillingAttachmentDto[]> {
  const byTarget = new Map<string, BillingAttachmentDto[]>();
  for (const attachment of attachments) {
    const list = byTarget.get(attachment.targetId) ?? [];
    list.push({
      id: attachment.id,
      fileName: attachment.fileName,
      publicUrl: attachment.publicUrl,
      sizeBytes: attachment.sizeBytes,
      createdAt: attachment.createdAt,
    });
    byTarget.set(attachment.targetId, list);
  }
  return byTarget;
}

function total(document: {
  lines: readonly { quantity: number; unitPriceCents: number }[];
  discountCents: number;
  taxRateBps: number;
}) {
  const subtotal = document.lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPriceCents,
    0,
  );
  const taxable = Math.max(0, subtotal - document.discountCents);
  return taxable + Math.round((taxable * document.taxRateBps) / 10_000);
}

export class PrismaBillingSummaryReader implements BillingSummaryReader {
  constructor(private readonly database: PrismaClient) {}

  async list(
    input: Readonly<{ worldKey: string; skip: number; take: number }>,
  ) {
    const where = { worldKey: input.worldKey };
    const [
      clients,
      quotes,
      totalQuotes,
      invoices,
      totalInvoices,
      allInvoices,
      catalogue,
    ] = await Promise.all([
      this.database.client.findMany({
        where: { ...where, status: "ACTIVE" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.database.quote.findMany({
        where,
        include: { client: true, lines: true, invoice: true },
        orderBy: { issuedAt: "desc" },
        skip: input.skip,
        take: input.take,
      }),
      this.database.quote.count({ where }),
      this.database.invoice.findMany({
        where,
        include: { client: true, lines: true, payments: true },
        orderBy: { issuedAt: "desc" },
        skip: input.skip,
        take: input.take,
      }),
      this.database.invoice.count({ where }),
      this.database.invoice.findMany({
        where,
        include: { lines: true, payments: true },
      }),
      this.database.catalogueItem.findMany({
        where: { ...where, status: "ACTIVE" },
        select: {
          id: true,
          label: true,
          kind: true,
          unitPriceCents: true,
          version: true,
        },
        orderBy: { label: "asc" },
      }),
    ]);

    const quoteIds = quotes.map((quote) => quote.id);
    const invoiceIds = invoices.map((invoice) => invoice.id);
    const [quoteAttachments, invoiceAttachments] = await Promise.all([
      quoteIds.length
        ? this.database.billingAttachment.findMany({
            where: { targetType: "QUOTE", targetId: { in: quoteIds } },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      invoiceIds.length
        ? this.database.billingAttachment.findMany({
            where: { targetType: "INVOICE", targetId: { in: invoiceIds } },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
    ]);
    const attachmentsByQuote = groupAttachments(quoteAttachments);
    const attachmentsByInvoice = groupAttachments(invoiceAttachments);

    const balances = clients.map((client) => {
      const owned = allInvoices.filter(
        (invoice) =>
          invoice.clientId === client.id && invoice.status !== "CANCELLED",
      );
      const billedCents = owned.reduce(
        (sum, invoice) => sum + total(invoice),
        0,
      );
      const paidCents = owned.reduce(
        (sum, invoice) =>
          sum +
          invoice.payments.reduce(
            (inner, payment) => inner + payment.amountCents,
            0,
          ),
        0,
      );
      return {
        clientId: client.id,
        clientName: client.name,
        billedCents,
        paidCents,
        balanceCents: Math.max(0, billedCents - paidCents),
      };
    });

    return {
      clients,
      quotes: quotes.map((quote) => ({
        id: quote.id,
        number: quote.number,
        clientName: quote.client.name,
        status: quote.status,
        version: quote.version,
        lineCount: quote.lines.length,
        totalCents: total(quote),
        validUntil: quote.validUntil,
        canConvert: quote.status === "ACCEPTED" && !quote.invoice,
        attachments: attachmentsByQuote.get(quote.id) ?? [],
      })),
      totalQuotes,
      invoices: invoices.map((invoice) => {
        const totalCents = total(invoice);
        const paidCents = invoice.payments.reduce(
          (sum, payment) => sum + payment.amountCents,
          0,
        );
        return {
          id: invoice.id,
          number: invoice.number,
          clientName: invoice.client.name,
          status: invoice.status,
          version: invoice.version,
          totalCents,
          paidCents,
          balanceCents: Math.max(0, totalCents - paidCents),
          dueAt: invoice.dueAt,
          attachments: attachmentsByInvoice.get(invoice.id) ?? [],
        };
      }),
      totalInvoices,
      balances,
      catalogue,
    };
  }
}
