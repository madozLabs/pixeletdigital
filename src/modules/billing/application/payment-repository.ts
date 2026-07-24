import type { Payment } from "../domain/payment";

export interface PaymentRepository {
  listByInvoice(invoiceId: string): Promise<readonly Payment[]>;
  totalPaidForInvoice(invoiceId: string): Promise<number>;
  save(payment: Payment): Promise<void>;
}
