import { beforeEach, describe, expect, it } from "vitest";

import type {
  ApprovedRole,
  AuthorizationScope,
  RequestContext,
} from "@/shared/request-context";
import type { Clock } from "@/shared/clock";

import { createConsentRecord } from "../domain/consent-record";
import { createGeneralEnquiry } from "../domain/enquiry";
import { listEnquiriesByWorld } from "./list-enquiries-by-world";
import { InMemoryEnquiryRepository } from "./testing/in-memory-enquiry-repository";

const now = new Date("2026-07-22T00:00:00.000Z");

function fixedClock(): Clock {
  return { now: () => now };
}

function context(
  role: ApprovedRole | null,
  scopes: readonly AuthorizationScope[],
  active = true,
): RequestContext {
  return {
    actor: { id: "user_01", active, role, scopes },
    correlationId: "correlation_01",
    clock: fixedClock(),
    origin: { channel: "WORKSPACE" },
  };
}

let enquiries: InMemoryEnquiryRepository;

beforeEach(async () => {
  enquiries = new InMemoryEnquiryRepository();

  const enquiryResult = createGeneralEnquiry({
    id: "enquiry_01",
    worldKey: "pixel-digital",
    name: "Alex Dupont",
    email: "alex@example.com",
    message: "Bonjour, je souhaite un devis.",
    sourcePage: "/contact",
    idempotencyKey: "idem_01",
    abuseStatus: "ACCEPTED",
    submittedAt: now,
  });
  if (!enquiryResult.ok) throw new Error("expected a valid enquiry");

  const consentResult = createConsentRecord({
    id: "consent_01",
    enquiryId: enquiryResult.value.id,
    purposeKey: "general_contact",
    version: 1,
    response: true,
    source: "contact_form",
    capturedAt: now,
  });
  if (!consentResult.ok) throw new Error("expected a valid consent record");

  await enquiries.save(enquiryResult.value, consentResult.value);
});

describe("listEnquiriesByWorld", () => {
  it("returns enquiries for an authorized actor with world scope", async () => {
    const result = await listEnquiriesByWorld(
      { enquiries },
      context("SALES", [{ type: "WORLD", worldKey: "pixel-digital" }]),
      { worldKey: "pixel-digital" },
    );

    expect(result).toMatchObject({
      ok: true,
      value: [{ id: "enquiry_01" }],
    });
  });

  it("returns enquiries for a global actor", async () => {
    const result = await listEnquiriesByWorld(
      { enquiries },
      context("SUPER_ADMIN", [{ type: "GLOBAL" }]),
      { worldKey: "pixel-digital" },
    );

    expect(result).toMatchObject({ ok: true, value: [{ id: "enquiry_01" }] });
  });

  it("rejects an unauthenticated actor", async () => {
    const anonymous: RequestContext = {
      actor: null,
      correlationId: "correlation_02",
      clock: fixedClock(),
      origin: { channel: "WORKSPACE" },
    };

    const result = await listEnquiriesByWorld({ enquiries }, anonymous, {
      worldKey: "pixel-digital",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("rejects a role without enquiry-viewing rights", async () => {
    const result = await listEnquiriesByWorld(
      { enquiries },
      context("EDITOR", [{ type: "WORLD", worldKey: "pixel-digital" }]),
      { worldKey: "pixel-digital" },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("rejects an actor without scope for the requested world", async () => {
    const result = await listEnquiriesByWorld(
      { enquiries },
      context("SALES", [{ type: "WORLD", worldKey: "kwaliti-print" }]),
      { worldKey: "pixel-digital" },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});
