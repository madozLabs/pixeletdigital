import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createWorld } from "@/modules/worlds/domain/world";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { createClient } from "../domain/client";
import {
  applyInvoicePayment,
  createDraftInvoice,
  type Invoice,
} from "../domain/invoice";
import { PrismaClientRepository } from "./prisma-client-repository";
import { PrismaInvoiceRepository } from "./prisma-invoice-repository";

let client: PrismaClient;
let repository: PrismaInvoiceRepository;
let clients: PrismaClientRepository;
let worlds: PrismaWorldRepository;

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL is required for database integration tests.",
    );
  }
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  repository = new PrismaInvoiceRepository(client);
  clients = new PrismaClientRepository(client);
  worlds = new PrismaWorldRepository(client);

  await worlds.save(validWorld());
  const clientResult = createClient({
    id: "billing_invoice_test_client",
    worldKey: "billing-invoice-test-world",
    name: "Client A",
    createdAt: new Date("2026-07-23T00:00:00.000Z"),
    updatedAt: new Date("2026-07-23T00:00:00.000Z"),
  });
  if (!clientResult.ok) throw new Error(clientResult.error.message);
  await clients.save(clientResult.value);
});

afterAll(async () => {
  await client.$disconnect();
});

describe("PrismaInvoiceRepository", () => {
  it("persists and reloads a draft invoice with its lines and computed totals", async () => {
    const invoice = validInvoice({ id: "billing_invoice_test_01" });

    await repository.save(invoice);
    const persisted = await repository.findById(invoice.id);

    expect(persisted).toEqual(invoice);
  });

  it("persists a status transition without touching lines", async () => {
    const invoice = validInvoice({
      id: "billing_invoice_test_02",
      number: "PD-FA-2026-0002",
    });
    await repository.save(invoice);
    const paid = applyInvoicePayment(
      invoice,
      invoice.totalCents,
      new Date("2026-07-23T10:00:00.000Z"),
    );
    if (!paid.ok) throw new Error("expected payment application to succeed");

    await repository.save(paid.value);
    const persisted = await repository.findById(invoice.id);

    expect(persisted).toEqual(paid.value);
    expect(persisted?.status).toBe("PAID");
  });

  it("counts invoices for a world", async () => {
    const before = await repository.countByWorld("billing-invoice-test-world");
    await repository.save(
      validInvoice({
        id: "billing_invoice_test_03",
        number: "PD-FA-2026-COUNT",
      }),
    );

    const after = await repository.countByWorld("billing-invoice-test-world");

    expect(after).toBe(before + 1);
  });

  it("returns null for a missing invoice", async () => {
    expect(await repository.findById("missing-invoice")).toBeNull();
  });
});

function validWorld() {
  const now = new Date("2026-07-23T00:00:00.000Z");
  const result = createWorld({
    id: "world_billing_invoice_test",
    key: "billing-invoice-test-world",
    displayName: "Billing Invoice Test World",
    mode: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function validInvoice(
  overrides: Partial<{ id: string; number: string }> = {},
): Invoice {
  const now = new Date("2026-07-23T00:00:00.000Z");
  const result = createDraftInvoice({
    id: overrides.id ?? "billing_invoice_test_default",
    worldKey: "billing-invoice-test-world",
    clientId: "billing_invoice_test_client",
    number: overrides.number ?? "PD-FA-2026-0001",
    lines: [
      {
        id: `${overrides.id ?? "default"}_line_01`,
        label: "Création de logo",
        quantity: 1,
        unitPriceCents: 45000,
      },
      {
        id: `${overrides.id ?? "default"}_line_02`,
        label: "Charte graphique",
        quantity: 2,
        unitPriceCents: 20000,
      },
    ],
    discountCents: 5000,
    taxRateBps: 1800,
    notes: "Acompte de 50% à la commande.",
    issuedAt: now,
    dueAt: new Date("2026-08-22T00:00:00.000Z"),
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
