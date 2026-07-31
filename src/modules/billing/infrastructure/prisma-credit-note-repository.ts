import type {
  CreditNote as PrismaCreditNote,
  CreditNoteLine as PrismaCreditNoteLine,
  PrismaClient,
} from "@/generated/prisma/client";

import type { CreditNoteRepository } from "../application/credit-note-repository";
import { restoreCreditNote, type CreditNote } from "../domain/credit-note";

type PrismaCreditNoteWithLines = PrismaCreditNote & {
  lines: PrismaCreditNoteLine[];
};

export class PrismaCreditNoteRepository implements CreditNoteRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(id: string): Promise<CreditNote | null> {
    const record = await this.client.creditNote.findUnique({
      where: { id },
      include: { lines: { orderBy: { order: "asc" } } },
    });
    return record ? toDomain(record) : null;
  }

  async listByInvoice(invoiceId: string): Promise<readonly CreditNote[]> {
    const records = await this.client.creditNote.findMany({
      where: { invoiceId },
      include: { lines: { orderBy: { order: "asc" } } },
      orderBy: { issuedAt: "asc" },
    });
    return records.map(toDomain);
  }

  async totalCreditedForInvoice(invoiceId: string): Promise<number> {
    const records = await this.client.creditNote.findMany({
      where: { invoiceId },
      include: { lines: true },
    });
    return records.reduce((sum, record) => sum + totalOf(record), 0);
  }

  async countByWorld(worldKey: string): Promise<number> {
    return this.client.creditNote.count({ where: { worldKey } });
  }

  // Append-only: a credit note is only ever created, never updated -- there
  // is no version-guarded update path here, unlike Invoice/Quote/Project.
  async save(creditNote: CreditNote): Promise<void> {
    await this.client.creditNote.create({
      data: {
        id: creditNote.id,
        worldKey: creditNote.worldKey,
        invoiceId: creditNote.invoiceId,
        number: creditNote.number,
        reason: creditNote.reason,
        notes: creditNote.notes,
        taxRateBps: creditNote.taxRateBps,
        issuedAt: creditNote.issuedAt,
        createdAt: creditNote.createdAt,
      },
    });
    for (const [index, line] of creditNote.lines.entries()) {
      await this.client.creditNoteLine.create({
        data: {
          id: line.id,
          creditNoteId: creditNote.id,
          label: line.label,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          order: index,
        },
      });
    }
  }
}

function totalOf(
  record: Readonly<{
    taxRateBps: number;
    lines: readonly Readonly<{ quantity: number; unitPriceCents: number }>[];
  }>,
): number {
  const subtotal = record.lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPriceCents,
    0,
  );
  return subtotal + Math.round((subtotal * record.taxRateBps) / 10000);
}

function toDomain(record: PrismaCreditNoteWithLines): CreditNote {
  const result = restoreCreditNote({
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
    throw new Error(`Persisted CreditNote is invalid: ${result.error.code}`);
  }
  return result.value;
}
