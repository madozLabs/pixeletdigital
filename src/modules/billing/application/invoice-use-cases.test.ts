import { describe, expect, it } from "vitest";

import { createWorld } from "@/modules/worlds/domain/world";
import { InMemoryWorldRepository } from "@/modules/worlds/application/testing/in-memory-world-repository";
import type { Clock } from "@/shared/clock";
import type {
  ApprovedRole,
  AuthorizationScope,
  RequestContext,
} from "@/shared/request-context";

import { createDraftInvoice as createDraftInvoiceDomain } from "../domain/invoice";
import {
  cancelInvoice,
  createDraftInvoice,
  listInvoicesByWorld,
  markInvoiceSent,
} from "./invoice-use-cases";
import { InMemoryInvoiceRepository } from "./testing/in-memory-invoice-repository";

const createdAt = new Date("2026-07-15T08:00:00.000Z");
const clockTime = new Date("2026-07-23T10:30:00.000Z");

describe("createDraftInvoice", () => {
  it.each<ApprovedRole>(["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER"])(
    "allows %s with a matching world scope and assigns a sequential number",
    async (role) => {
      const dependencies = dependenciesWithWorld();

      const result = await createDraftInvoice(
        dependencies,
        context(role, [{ type: "WORLD", worldKey: "pixel-digital" }]),
        validCreateInput(),
      );

      expect(result).toMatchObject({
        ok: true,
        value: {
          status: "DRAFT",
          number: "PD-FA-2026-0001",
          totalCents: 45000,
        },
      });
      expect(dependencies.invoices.savedInvoices).toHaveLength(1);
    },
  );

  it("increments the sequence for subsequent invoices in the same world", async () => {
    const dependencies = dependenciesWithWorld();
    await createDraftInvoice(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      validCreateInput(),
    );

    const result = await createDraftInvoice(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      validCreateInput(),
    );

    expect(result).toMatchObject({
      ok: true,
      value: { number: "PD-FA-2026-0002" },
    });
  });

  it("applies discount and tax to the computed total", async () => {
    const dependencies = dependenciesWithWorld();

    const result = await createDraftInvoice(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      { ...validCreateInput(), discountCents: 5000, taxRateBps: 1000 },
    );

    expect(result).toMatchObject({ ok: true, value: { totalCents: 44000 } });
  });

  it.each<ApprovedRole>(["EDITOR", "SALES", "CONTRIBUTOR", "READER"])(
    "denies %s even with world scope",
    async (role) => {
      const dependencies = dependenciesWithWorld();

      const result = await createDraftInvoice(
        dependencies,
        context(role, [{ type: "GLOBAL" }]),
        validCreateInput(),
      );

      expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      expect(dependencies.invoices.savedInvoices).toHaveLength(0);
    },
  );
});

describe("listInvoicesByWorld", () => {
  it("denies a role outside the billing set", async () => {
    const dependencies = dependenciesWithWorld();

    const result = await listInvoicesByWorld(
      dependencies,
      context("EDITOR", [{ type: "WORLD", worldKey: "pixel-digital" }]),
      { worldKey: "pixel-digital" },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});

describe("invoice lifecycle use-cases", () => {
  it("transitions DRAFT -> SENT", async () => {
    const dependencies = dependenciesWithWorld();
    const invoice = savedInvoice();
    await dependencies.invoices.save(invoice);

    const sent = await markInvoiceSent(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      { id: invoice.id, expectedVersion: invoice.version },
    );
    expect(sent).toMatchObject({ ok: true, value: { status: "SENT" } });
  });

  it("cancels a draft invoice", async () => {
    const dependencies = dependenciesWithWorld();
    const invoice = savedInvoice();
    await dependencies.invoices.save(invoice);

    const result = await cancelInvoice(
      dependencies,
      context("SUPER_ADMIN", [{ type: "GLOBAL" }]),
      { id: invoice.id, expectedVersion: invoice.version },
    );

    expect(result).toMatchObject({ ok: true, value: { status: "CANCELLED" } });
  });

  it("returns CONFLICT on a stale version", async () => {
    const dependencies = dependenciesWithWorld();
    const invoice = savedInvoice();
    await dependencies.invoices.save(invoice);

    const result = await cancelInvoice(
      dependencies,
      context("SUPER_ADMIN", [{ type: "GLOBAL" }]),
      { id: invoice.id, expectedVersion: invoice.version + 1 },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
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
    invoices: new InMemoryInvoiceRepository(),
    worlds: new InMemoryWorldRepository([world.value]),
  };
}

function validCreateInput() {
  return {
    id: `invoice_use_case_${Math.random().toString(36).slice(2)}`,
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

function savedInvoice() {
  const result = createDraftInvoiceDomain({
    id: "invoice_use_case_saved",
    worldKey: "pixel-digital",
    clientId: "client_01",
    number: "PD-FA-2026-0001",
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
  if (!result.ok) throw new Error("expected a valid draft invoice");
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
