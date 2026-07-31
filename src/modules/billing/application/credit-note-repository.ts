import type { CreditNote } from "../domain/credit-note";

export interface CreditNoteRepository {
  findById(id: string): Promise<CreditNote | null>;
  listByInvoice(invoiceId: string): Promise<readonly CreditNote[]>;
  totalCreditedForInvoice(invoiceId: string): Promise<number>;
  countByWorld(worldKey: string): Promise<number>;
  save(creditNote: CreditNote): Promise<void>;
}
