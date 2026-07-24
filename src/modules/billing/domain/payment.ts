export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export const PAYMENT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "MOBILE_MONEY",
  "CARD",
  "CHEQUE",
  "OTHER",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type PaymentDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_INVOICE_ID"
  | "INVALID_AMOUNT_CENTS"
  | "INVALID_METHOD"
  | "INVALID_REFERENCE"
  | "INVALID_NOTES";

export type PaymentDomainError = Readonly<{
  code: PaymentDomainErrorCode;
  message: string;
}>;

export type Payment = Readonly<{
  id: string;
  invoiceId: string;
  amountCents: number;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  paidAt: Date;
  createdAt: Date;
}>;

export function isPaymentMethod(value: string): value is PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod);
}

export function recordPayment(
  input: Readonly<{
    id: string;
    invoiceId: string;
    amountCents: number;
    method: string;
    reference?: string | null;
    notes?: string | null;
    paidAt: Date;
    createdAt: Date;
  }>,
): Result<Payment, PaymentDomainError> {
  const id = input.id.trim();
  if (!id) {
    return failure(
      "INVALID_ID",
      "Payment id must be a non-empty opaque identifier.",
    );
  }

  const invoiceId = input.invoiceId.trim();
  if (!invoiceId) {
    return failure(
      "INVALID_INVOICE_ID",
      "Payment invoiceId must be a non-empty identifier.",
    );
  }

  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return failure(
      "INVALID_AMOUNT_CENTS",
      "Payment amountCents must be a positive integer.",
    );
  }

  if (!isPaymentMethod(input.method)) {
    return failure(
      "INVALID_METHOD",
      "Payment method is not part of the controlled vocabulary.",
    );
  }

  if (input.reference && input.reference.trim().length > 160) {
    return failure(
      "INVALID_REFERENCE",
      "Payment reference must contain at most 160 characters.",
    );
  }

  if (input.notes && input.notes.trim().length > 500) {
    return failure(
      "INVALID_NOTES",
      "Payment notes must contain at most 500 characters.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      invoiceId,
      amountCents: input.amountCents,
      method: input.method,
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
      paidAt: new Date(input.paidAt),
      createdAt: new Date(input.createdAt),
    }),
  };
}

export function restorePayment(
  input: Readonly<{
    id: string;
    invoiceId: string;
    amountCents: number;
    method: string;
    reference: string | null;
    notes: string | null;
    paidAt: Date;
    createdAt: Date;
  }>,
): Result<Payment, PaymentDomainError> {
  return recordPayment(input);
}

function failure(
  code: PaymentDomainErrorCode,
  message: string,
): Result<never, PaymentDomainError> {
  return { ok: false, error: { code, message } };
}
