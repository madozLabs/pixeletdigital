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

  async save(invoice: Invoice): Promise<void> {
    this.savedInvoices.push(invoice);
    this.invoicesById.set(invoice.id, invoice);
  }
}
