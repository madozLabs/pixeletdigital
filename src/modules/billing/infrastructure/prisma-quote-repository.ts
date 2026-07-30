import type {
  Quote as PrismaQuote,
  QuoteLine as PrismaQuoteLine,
  PrismaClient,
} from "@/generated/prisma/client";

import type { QuoteRepository } from "../application/quote-repository";
import { restoreQuote, type Quote } from "../domain/quote";

type PrismaQuoteWithLines = PrismaQuote & { lines: PrismaQuoteLine[] };

export class PrismaQuoteRepository implements QuoteRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(id: string): Promise<Quote | null> {
    const record = await this.client.quote.findUnique({
      where: { id },
      include: { lines: { orderBy: { order: "asc" } } },
    });
    return record ? toDomain(record) : null;
  }

  async listByWorld(worldKey: string): Promise<readonly Quote[]> {
    const records = await this.client.quote.findMany({
      where: { worldKey },
      include: { lines: { orderBy: { order: "asc" } } },
      orderBy: { issuedAt: "desc" },
    });
    return records.map(toDomain);
  }

  async countByWorld(worldKey: string): Promise<number> {
    return this.client.quote.count({ where: { worldKey } });
  }

  async hasInvoice(quoteId: string): Promise<boolean> {
    const invoice = await this.client.invoice.findUnique({
      where: { quoteId },
      select: { id: true },
    });
    return invoice !== null;
  }

  // Same rationale as PrismaInvoiceRepository.save: no interactive
  // $transaction, lines are immutable after creation.
  async save(quote: Quote): Promise<boolean> {
    const existing = await this.client.quote.findUnique({
      where: { id: quote.id },
      select: { id: true },
    });

    if (!existing) {
      await this.client.quote.create({
        data: {
          id: quote.id,
          worldKey: quote.worldKey,
          clientId: quote.clientId,
          number: quote.number,
          status: quote.status,
          discountCents: quote.discountCents,
          taxRateBps: quote.taxRateBps,
          notes: quote.notes,
          issuedAt: quote.issuedAt,
          validUntil: quote.validUntil,
          convertedAt: quote.convertedAt,
          version: quote.version,
          createdAt: quote.createdAt,
          updatedAt: quote.updatedAt,
        },
      });
      for (const [index, line] of quote.lines.entries()) {
        await this.client.quoteLine.create({
          data: {
            id: line.id,
            quoteId: quote.id,
            label: line.label,
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents,
            order: index,
          },
        });
      }
      return true;
    }

    // Guarded by the version the caller read (quote.version - 1, since every
    // domain transition increments by exactly 1): a concurrent write that
    // already bumped the row past that version makes this a no-op instead of
    // a silent overwrite -- count === 0 signals the conflict to the caller
    // rather than throwing. Mirrors PrismaInvoiceRepository.save.
    const updated = await this.client.quote.updateMany({
      where: { id: quote.id, version: quote.version - 1 },
      data: {
        status: quote.status,
        convertedAt: quote.convertedAt,
        version: quote.version,
        updatedAt: quote.updatedAt,
      },
    });
    return updated.count > 0;
  }
}

function toDomain(record: PrismaQuoteWithLines): Quote {
  const result = restoreQuote({
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
    throw new Error(`Persisted Quote is invalid: ${result.error.code}`);
  }
  return result.value;
}
