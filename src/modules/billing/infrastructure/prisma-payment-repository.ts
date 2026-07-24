import type {
  Payment as PrismaPayment,
  PrismaClient,
} from "@/generated/prisma/client";

import type { PaymentRepository } from "../application/payment-repository";
import { restorePayment, type Payment } from "../domain/payment";

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly client: PrismaClient) {}

  async listByInvoice(invoiceId: string): Promise<readonly Payment[]> {
    const records = await this.client.payment.findMany({
      where: { invoiceId },
      orderBy: { paidAt: "asc" },
    });
    return records.map(toDomain);
  }

  async totalPaidForInvoice(invoiceId: string): Promise<number> {
    const result = await this.client.payment.aggregate({
      where: { invoiceId },
      _sum: { amountCents: true },
    });
    return result._sum.amountCents ?? 0;
  }

  async save(payment: Payment): Promise<void> {
    await this.client.payment.create({
      data: {
        id: payment.id,
        invoiceId: payment.invoiceId,
        amountCents: payment.amountCents,
        method: payment.method,
        reference: payment.reference,
        notes: payment.notes,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
      },
    });
  }
}

function toDomain(record: PrismaPayment): Payment {
  const result = restorePayment(record);
  if (!result.ok) {
    throw new Error(`Persisted Payment is invalid: ${result.error.code}`);
  }
  return result.value;
}
