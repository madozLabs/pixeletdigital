import type { Quote } from "../../domain/quote";
import type { QuoteRepository } from "../quote-repository";

export class InMemoryQuoteRepository implements QuoteRepository {
  readonly savedQuotes: Quote[] = [];
  private readonly quotesById = new Map<string, Quote>();
  private readonly invoicedQuoteIds = new Set<string>();

  constructor(quotes: readonly Quote[] = []) {
    for (const quote of quotes) this.quotesById.set(quote.id, quote);
  }

  async findById(id: string): Promise<Quote | null> {
    return this.quotesById.get(id) ?? null;
  }

  async listByWorld(worldKey: string): Promise<readonly Quote[]> {
    return [...this.quotesById.values()]
      .filter((quote) => quote.worldKey === worldKey)
      .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());
  }

  async countByWorld(worldKey: string): Promise<number> {
    return [...this.quotesById.values()].filter(
      (quote) => quote.worldKey === worldKey,
    ).length;
  }

  async hasInvoice(quoteId: string): Promise<boolean> {
    return this.invoicedQuoteIds.has(quoteId);
  }

  markInvoiced(quoteId: string): void {
    this.invoicedQuoteIds.add(quoteId);
  }

  async save(quote: Quote): Promise<void> {
    this.savedQuotes.push(quote);
    this.quotesById.set(quote.id, quote);
    if (quote.status === "CONVERTED") this.invoicedQuoteIds.add(quote.id);
  }
}
