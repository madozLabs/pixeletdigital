import { describe, expect, it } from "vitest";

import { createWorld } from "@/modules/worlds/domain/world";
import { InMemoryWorldRepository } from "@/modules/worlds/application/testing/in-memory-world-repository";
import type { Clock } from "@/shared/clock";
import type {
  ApprovedRole,
  AuthorizationScope,
  RequestContext,
} from "@/shared/request-context";

import { createDraftQuote as createDraftQuoteDomain } from "../domain/quote";
import {
  convertQuoteToInvoice,
  createDraftQuote,
  updateQuoteStatus,
} from "./quote-use-cases";
import { InMemoryInvoiceRepository } from "./testing/in-memory-invoice-repository";
import { InMemoryQuoteRepository } from "./testing/in-memory-quote-repository";

const createdAt = new Date("2026-07-15T08:00:00.000Z");
const clockTime = new Date("2026-07-23T10:30:00.000Z");

describe("createDraftQuote", () => {
  it.each<ApprovedRole>(["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER"])(
    "allows %s with a matching world scope",
    async (role) => {
      const dependencies = dependenciesWithWorld();

      const result = await createDraftQuote(
        dependencies,
        context(role, [{ type: "WORLD", worldKey: "pixel-digital" }]),
        validCreateInput(),
      );

      expect(result).toMatchObject({
        ok: true,
        value: { status: "DRAFT", number: "PD-DV-2026-0001" },
      });
    },
  );

  it.each<ApprovedRole>(["EDITOR", "SALES", "CONTRIBUTOR", "READER"])(
    "denies %s even with world scope",
    async (role) => {
      const dependencies = dependenciesWithWorld();

      const result = await createDraftQuote(
        dependencies,
        context(role, [{ type: "GLOBAL" }]),
        validCreateInput(),
      );

      expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    },
  );
});

describe("updateQuoteStatus", () => {
  it("transitions DRAFT to ACCEPTED", async () => {
    const dependencies = dependenciesWithWorld();
    const quote = savedQuote(dependencies);

    const result = await updateQuoteStatus(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      { id: quote.id, expectedVersion: quote.version, status: "ACCEPTED" },
    );

    expect(result).toMatchObject({ ok: true, value: { status: "ACCEPTED" } });
  });
});

describe("convertQuoteToInvoice", () => {
  it("converts an accepted quote into a draft invoice and marks the quote CONVERTED", async () => {
    const dependencies = dependenciesWithWorld();
    const quote = savedQuote(dependencies);
    const accepted = await updateQuoteStatus(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      { id: quote.id, expectedVersion: quote.version, status: "ACCEPTED" },
    );
    if (!accepted.ok) throw new Error("expected acceptance to succeed");

    const invoiceDependencies = {
      ...dependencies,
      invoices: new InMemoryInvoiceRepository(),
    };
    const result = await convertQuoteToInvoice(
      invoiceDependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      {
        id: quote.id,
        expectedVersion: accepted.value.version,
        invoiceId: "invoice_from_quote_01",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { status: "DRAFT", clientId: "client_01", quoteId: quote.id },
    });
    const convertedQuote = await dependencies.quotes.findById(quote.id);
    expect(convertedQuote?.status).toBe("CONVERTED");
  });

  it("rejects converting a quote that is not ACCEPTED", async () => {
    const dependencies = dependenciesWithWorld();
    const quote = savedQuote(dependencies);
    const invoiceDependencies = {
      ...dependencies,
      invoices: new InMemoryInvoiceRepository(),
    };

    const result = await convertQuoteToInvoice(
      invoiceDependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      {
        id: quote.id,
        expectedVersion: quote.version,
        invoiceId: "invoice_from_quote_02",
      },
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", validationCode: "INVALID_TRANSITION" },
    });
  });
});

function dependenciesWithWorld() {
  const world = createWorld({
    id: "world_01",
    key: "pixel-digital",
    displayName: "Pixel&Digital",
    mode: "ACTIVE",
    createdAt,
    updatedAt: createdAt,
  });
  if (!world.ok) throw new Error("expected a valid world");

  return {
    quotes: new InMemoryQuoteRepository(),
    worlds: new InMemoryWorldRepository([world.value]),
  };
}

function validCreateInput() {
  return {
    id: `quote_use_case_${Math.random().toString(36).slice(2)}`,
    worldKey: "pixel-digital",
    clientId: "client_01",
    lines: [
      {
        id: "line_01",
        label: "Création de logo",
        quantity: 1,
        unitPriceCents: 45000,
      },
    ],
    issuedAt: createdAt,
  };
}

function savedQuote(dependencies: ReturnType<typeof dependenciesWithWorld>) {
  const result = createDraftQuoteDomain({
    id: "quote_use_case_saved",
    worldKey: "pixel-digital",
    clientId: "client_01",
    number: "PD-DV-2026-0001",
    lines: [
      {
        id: "line_01",
        label: "Création de logo",
        quantity: 1,
        unitPriceCents: 45000,
      },
    ],
    issuedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  });
  if (!result.ok) throw new Error("expected a valid draft quote");
  dependencies.quotes.save(result.value);
  return result.value;
}

function context(
  role: ApprovedRole,
  scopes: readonly AuthorizationScope[],
): RequestContext {
  const clock: Clock = { now: () => clockTime };
  return {
    actor: { id: "actor_01", active: true, role, scopes },
    correlationId: "test-correlation-id",
    clock,
    origin: { channel: "WORKSPACE" },
  };
}
