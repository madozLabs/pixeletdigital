import type { Payment } from "../../domain/payment";
import type { PaymentRepository } from "../payment-repository";

export class InMemoryPaymentRepository implements PaymentRepository {
  readonly savedPayments: Payment[] = [];

  async listByInvoice(invoiceId: string): Promise<readonly Payment[]> {
    return this.savedPayments
      .filter((payment) => payment.invoiceId === invoiceId)
      .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());
  }

  async totalPaidForInvoice(invoiceId: string): Promise<number> {
    return this.savedPayments
      .filter((payment) => payment.invoiceId === invoiceId)
      .reduce((sum, payment) => sum + payment.amountCents, 0);
  }

  async save(payment: Payment): Promise<void> {
    this.savedPayments.push(payment);
  }
}
