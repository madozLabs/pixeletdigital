import type {
  Invoice as PrismaInvoice,
  InvoiceLine as PrismaInvoiceLine,
  PrismaClient,
} from "@/generated/prisma/client";

import type { InvoiceRepository } from "../application/invoice-repository";
import { restoreInvoice, type Invoice } from "../domain/invoice";

type PrismaInvoiceWithLines = PrismaInvoice & { lines: PrismaInvoiceLine[] };

export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(id: string): Promise<Invoice | null> {
    const record = await this.client.invoice.findUnique({
      where: { id },
      include: { lines: { orderBy: { order: "asc" } } },
    });
    return record ? toDomain(record) : null;
  }

  async listByWorld(worldKey: string): Promise<readonly Invoice[]> {
    const records = await this.client.invoice.findMany({
      where: { worldKey },
      include: { lines: { orderBy: { order: "asc" } } },
      orderBy: { issuedAt: "desc" },
    });
    return records.map(toDomain);
  }

  async countByWorld(worldKey: string): Promise<number> {
    return this.client.invoice.count({ where: { worldKey } });
  }

  // Deliberately not wrapped in $transaction(async (tx) => {...}); see
  // PrismaEnquiryRepository.save for why interactive transactions are
  // avoided in this codebase. Invoice lines are immutable once created
  // (the domain never edits them after createDraftInvoice), so only the
  // create path needs to also persist lines -- later saves only touch the
  // invoice's own status/version fields.
  async save(invoice: Invoice): Promise<void> {
    const existing = await this.client.invoice.findUnique({
      where: { id: invoice.id },
      select: { id: true },
    });

    if (!existing) {
      await this.client.invoice.create({
        data: {
          id: invoice.id,
          worldKey: invoice.worldKey,
          clientId: invoice.clientId,
          number: invoice.number,
          status: invoice.status,
          issuedAt: invoice.issuedAt,
          version: invoice.version,
          createdAt: invoice.createdAt,
          updatedAt: invoice.updatedAt,
        },
      });
      for (const [index, line] of invoice.lines.entries()) {
        await this.client.invoiceLine.create({
          data: {
            id: line.id,
            invoiceId: invoice.id,
            label: line.label,
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents,
            order: index,
          },
        });
      }
      return;
    }

    await this.client.invoice.update({
      where: { id: invoice.id },
      data: {
        status: invoice.status,
        version: invoice.version,
        updatedAt: invoice.updatedAt,
      },
    });
  }
}

function toDomain(record: PrismaInvoiceWithLines): Invoice {
  const result = restoreInvoice({
    ...record,
    lines: record.lines.map((line) => ({
      id: line.id,
      label: line.label,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      totalCents: line.quantity * line.unitPriceCents,
    })),
  });
  if (!result.ok) {
    throw new Error(`Persisted Invoice is invalid: ${result.error.code}`);
  }
  return result.value;
}
