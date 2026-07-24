import type { Quote } from "../domain/quote";

export interface QuoteRepository {
  findById(id: string): Promise<Quote | null>;
  listByWorld(worldKey: string): Promise<readonly Quote[]>;
  countByWorld(worldKey: string): Promise<number>;
  hasInvoice(quoteId: string): Promise<boolean>;
  save(quote: Quote): Promise<void>;
}
