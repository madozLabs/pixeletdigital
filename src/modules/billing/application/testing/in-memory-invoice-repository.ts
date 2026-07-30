import type { Invoice } from "../../domain/invoice";
import type { InvoiceRepository } from "../invoice-repository";

export class InMemoryInvoiceRepository implements InvoiceRepository {
  readonly savedInvoices: Invoice[] = [];
  private readonly invoicesById = new Map<string, Invoice>();

  constructor(invoices: readonly Invoice[] = []) {
    for (const invoice of invoices) this.invoicesById.set(invoice.id, invoice);
  }

  async findById(id: string): Promise<Invoice | null> {
    return this.invoicesById.get(id) ?? null;
  }

  async listByWorld(worldKey: string): Promise<readonly Invoice[]> {
    return [...this.invoicesById.values()]
      .filter((invoice) => invoice.worldKey === worldKey)
      .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime());
  }

  async countByWorld(worldKey: string): Promise<number> {
    return [...this.invoicesById.values()].filter(
      (invoice) => invoice.worldKey === worldKey,
    ).length;
  }

  async save(invoice: Invoice): Promise<boolean> {
    const existing = this.invoicesById.get(invoice.id);
    if (existing && existing.version !== invoice.version - 1) return false;
    if (!existing) {
      const numberTaken = [...this.invoicesById.values()].some(
        (other) =>
          other.worldKey === invoice.worldKey &&
          other.number === invoice.number,
      );
      // Mirrors the @@unique([worldKey, number]) constraint enforced by
      // Postgres, so createDraftInvoice's retry-on-collision logic can be
      // exercised against this fake the same way it is against the real
      // repository.
      if (numberTaken) {
        const error = new Error(
          "Unique constraint failed on the fields: (`worldKey`,`number`)",
        ) as Error & { code: string };
        error.code = "P2002";
        throw error;
      }
    }
    this.savedInvoices.push(invoice);
    this.invoicesById.set(invoice.id, invoice);
    return true;
  }
}
