import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createWorld } from "@/modules/worlds/domain/world";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { createClient } from "../domain/client";
import { createDraftQuote, setQuoteStatus, type Quote } from "../domain/quote";
import { PrismaClientRepository } from "./prisma-client-repository";
import { PrismaQuoteRepository } from "./prisma-quote-repository";

let client: PrismaClient;
let repository: PrismaQuoteRepository;
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
  repository = new PrismaQuoteRepository(client);
  clients = new PrismaClientRepository(client);
  worlds = new PrismaWorldRepository(client);

  await worlds.save(validWorld());
  const clientResult = createClient({
    id: "billing_quote_test_client",
    worldKey: "billing-quote-test-world",
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

describe("PrismaQuoteRepository", () => {
  it("persists and reloads a draft quote with its lines", async () => {
    const quote = validQuote({ id: "billing_quote_test_01" });

    await repository.save(quote);
    const persisted = await repository.findById(quote.id);

    expect(persisted).toEqual(quote);
  });

  it("persists a status transition without touching lines", async () => {
    const quote = validQuote({
      id: "billing_quote_test_02",
      number: "PD-DV-2026-0002",
    });
    await repository.save(quote);
    const accepted = setQuoteStatus(
      quote,
      "ACCEPTED",
      new Date("2026-07-23T10:00:00.000Z"),
    );
    if (!accepted.ok) throw new Error("expected transition to succeed");

    await repository.save(accepted.value);
    const persisted = await repository.findById(quote.id);

    expect(persisted).toEqual(accepted.value);
  });

  it("reports whether a quote has already been converted to an invoice", async () => {
    const quote = validQuote({
      id: "billing_quote_test_03",
      number: "PD-DV-2026-0003",
    });
    await repository.save(quote);

    expect(await repository.hasInvoice(quote.id)).toBe(false);
  });

  it("counts quotes for a world", async () => {
    const before = await repository.countByWorld("billing-quote-test-world");
    await repository.save(
      validQuote({ id: "billing_quote_test_04", number: "PD-DV-2026-COUNT" }),
    );

    const after = await repository.countByWorld("billing-quote-test-world");

    expect(after).toBe(before + 1);
  });

  it("returns null for a missing quote", async () => {
    expect(await repository.findById("missing-quote")).toBeNull();
  });
});

function validWorld() {
  const now = new Date("2026-07-23T00:00:00.000Z");
  const result = createWorld({
    id: "world_billing_quote_test",
    key: "billing-quote-test-world",
    displayName: "Billing Quote Test World",
    mode: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function validQuote(
  overrides: Partial<{ id: string; number: string }> = {},
): Quote {
  const now = new Date("2026-07-23T00:00:00.000Z");
  const result = createDraftQuote({
    id: overrides.id ?? "billing_quote_test_default",
    worldKey: "billing-quote-test-world",
    clientId: "billing_quote_test_client",
    number: overrides.number ?? "PD-DV-2026-0001",
    lines: [
      {
        id: `${overrides.id ?? "default"}_line_01`,
        label: "Création de logo",
        quantity: 1,
        unitPriceCents: 45000,
      },
    ],
    discountCents: 0,
    taxRateBps: 1800,
    notes: null,
    issuedAt: now,
    validUntil: new Date("2026-08-23T00:00:00.000Z"),
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
