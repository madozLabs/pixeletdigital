import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createWorld } from "@/modules/worlds/domain/world";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { createClient } from "../domain/client";
import { createDraftInvoice } from "../domain/invoice";
import { recordPayment } from "../domain/payment";
import { PrismaClientRepository } from "./prisma-client-repository";
import { PrismaInvoiceRepository } from "./prisma-invoice-repository";
import { PrismaPaymentRepository } from "./prisma-payment-repository";

let client: PrismaClient;
let repository: PrismaPaymentRepository;
let invoices: PrismaInvoiceRepository;
let invoiceId: string;

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL is required for database integration tests.",
    );
  }
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  repository = new PrismaPaymentRepository(client);
  invoices = new PrismaInvoiceRepository(client);
  const clients = new PrismaClientRepository(client);
  const worlds = new PrismaWorldRepository(client);
  const now = new Date("2026-07-23T00:00:00.000Z");

  const worldResult = createWorld({
    id: "world_billing_payment_test",
    key: "billing-payment-test-world",
    displayName: "Billing Payment Test World",
    mode: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
  if (!worldResult.ok) throw new Error(worldResult.error.message);
  await worlds.save(worldResult.value);

  const clientResult = createClient({
    id: "billing_payment_test_client",
    worldKey: "billing-payment-test-world",
    name: "Client A",
    createdAt: now,
    updatedAt: now,
  });
  if (!clientResult.ok) throw new Error(clientResult.error.message);
  await clients.save(clientResult.value);

  const invoiceResult = createDraftInvoice({
    id: "billing_payment_test_invoice",
    worldKey: "billing-payment-test-world",
    clientId: "billing_payment_test_client",
    number: "PD-FA-2026-PAY01",
    lines: [
      {
        id: "line_01",
        label: "Création de logo",
        quantity: 1,
        unitPriceCents: 45000,
      },
    ],
    issuedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  if (!invoiceResult.ok) throw new Error(invoiceResult.error.message);
  await invoices.save(invoiceResult.value);
  invoiceId = invoiceResult.value.id;
});

afterAll(async () => {
  await client.$disconnect();
});

describe("PrismaPaymentRepository", () => {
  it("persists a payment and lists it by invoice", async () => {
    const paymentResult = recordPayment({
      id: "billing_payment_test_01",
      invoiceId,
      amountCents: 20000,
      method: "MOBILE_MONEY",
      reference: "TXN-001",
      paidAt: new Date("2026-07-23T10:00:00.000Z"),
      createdAt: new Date("2026-07-23T10:00:00.000Z"),
    });
    if (!paymentResult.ok) throw new Error("expected a valid payment");

    await repository.save(paymentResult.value);
    const found = await repository.listByInvoice(invoiceId);

    expect(found.map((p) => p.id)).toContain("billing_payment_test_01");
  });

  it("sums total paid for an invoice across multiple payments", async () => {
    const second = recordPayment({
      id: "billing_payment_test_02",
      invoiceId,
      amountCents: 15000,
      method: "CASH",
      paidAt: new Date("2026-07-23T11:00:00.000Z"),
      createdAt: new Date("2026-07-23T11:00:00.000Z"),
    });
    if (!second.ok) throw new Error("expected a valid payment");
    await repository.save(second.value);

    const total = await repository.totalPaidForInvoice(invoiceId);

    expect(total).toBe(35000);
  });
});
