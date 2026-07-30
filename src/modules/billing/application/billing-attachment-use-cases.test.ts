import { describe, expect, it } from "vitest";

import type { Clock } from "@/shared/clock";
import type {
  ApprovedRole,
  AuthorizationScope,
  RequestContext,
} from "@/shared/request-context";

import { createDraftQuote as createDraftQuoteDomain } from "../domain/quote";
import {
  deleteBillingAttachment,
  listBillingAttachments,
  uploadBillingAttachment,
} from "./billing-attachment-use-cases";
import { InMemoryBillingAttachmentRepository } from "./testing/in-memory-billing-attachment-repository";
import { InMemoryInvoiceRepository } from "./testing/in-memory-invoice-repository";
import { InMemoryQuoteRepository } from "./testing/in-memory-quote-repository";

const createdAt = new Date("2026-07-23T00:00:00.000Z");
const clockTime = new Date("2026-07-23T10:30:00.000Z");

describe("uploadBillingAttachment", () => {
  it("attaches a file to a quote the actor can access", async () => {
    const dependencies = dependenciesWithQuote();

    const result = await uploadBillingAttachment(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      validUploadInput(),
    );

    expect(result).toMatchObject({
      ok: true,
      value: { fileName: "bon-de-commande.pdf", worldKey: "pixel-digital" },
    });
  });

  it("returns NOT_FOUND for a missing quote", async () => {
    const dependencies = dependenciesWithQuote();

    const result = await uploadBillingAttachment(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      { ...validUploadInput(), targetId: "missing-quote" },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it.each<ApprovedRole>(["EDITOR", "SALES", "CONTRIBUTOR", "READER"])(
    "denies %s",
    async (role) => {
      const dependencies = dependenciesWithQuote();

      const result = await uploadBillingAttachment(
        dependencies,
        context(role, [{ type: "GLOBAL" }]),
        validUploadInput(),
      );

      expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    },
  );
});

describe("deleteBillingAttachment", () => {
  it("deletes an attachment the actor can access", async () => {
    const dependencies = dependenciesWithQuote();
    const uploaded = await uploadBillingAttachment(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      validUploadInput(),
    );
    if (!uploaded.ok) throw new Error("expected upload to succeed");

    const result = await deleteBillingAttachment(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      { id: uploaded.value.id },
    );

    expect(result.ok).toBe(true);
    expect(await dependencies.attachments.findById(uploaded.value.id)).toBeNull();
  });

  it("returns NOT_FOUND for a missing attachment", async () => {
    const dependencies = dependenciesWithQuote();

    const result = await deleteBillingAttachment(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      { id: "missing-attachment" },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });
});

describe("listBillingAttachments", () => {
  it("lists attachments for a target", async () => {
    const dependencies = dependenciesWithQuote();
    await uploadBillingAttachment(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      validUploadInput(),
    );

    const result = await listBillingAttachments(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      { targetType: "QUOTE", targetId: "quote_test_01", worldKey: "pixel-digital" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
  });
});

function dependenciesWithQuote() {
  const attachments = new InMemoryBillingAttachmentRepository();
  const quotes = new InMemoryQuoteRepository();
  const invoices = new InMemoryInvoiceRepository();
  const quoteResult = createDraftQuoteDomain({
    id: "quote_test_01",
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
    discountCents: 0,
    taxRateBps: 0,
    notes: null,
    issuedAt: createdAt,
    validUntil: null,
    createdAt,
    updatedAt: createdAt,
  });
  if (!quoteResult.ok) throw new Error("expected a valid draft quote");
  quotes.save(quoteResult.value);
  return { attachments, quotes, invoices };
}

function validUploadInput() {
  return {
    id: "billing_attachment_test_01",
    targetType: "QUOTE",
    targetId: "quote_test_01",
    fileName: "bon-de-commande.pdf",
    bucket: "site-media",
    objectPath: "pixel-digital/attachments/bon-de-commande.pdf",
    publicUrl: "https://example.com/bon-de-commande.pdf",
    mimeType: "application/pdf",
    sizeBytes: 45000,
  };
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
