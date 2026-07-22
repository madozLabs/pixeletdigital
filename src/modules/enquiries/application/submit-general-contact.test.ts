import { beforeEach, describe, expect, it } from "vitest";

import {
  approveServiceAsCurrent,
  createDraftService,
  submitServiceForReview,
} from "@/modules/content/application/service-use-cases";
import { InMemoryServiceRepository } from "@/modules/content/application/testing/in-memory-service-repository";
import { publishService } from "@/modules/content/domain/service";
import { createWorld } from "@/modules/worlds/domain/world";
import { InMemoryWorldRepository } from "@/modules/worlds/application/testing/in-memory-world-repository";
import type { Clock } from "@/shared/clock";
import type {
  ApprovedRole,
  AuthorizationScope,
} from "@/shared/request-context";

import { InMemoryEnquiryRepository } from "./testing/in-memory-enquiry-repository";
import {
  submitGeneralContact,
  type EnquiryDependencies,
} from "./submit-general-contact";

const now = new Date("2026-07-22T00:00:00.000Z");

function fixedClock(): Clock {
  return { now: () => now };
}

function validWorld() {
  const result = createWorld({
    id: "world_pixel_digital",
    key: "pixel-digital",
    displayName: "Pixel&Digital",
    mode: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error("expected a valid world");
  return result.value;
}

function validInput() {
  return {
    id: "enquiry_01",
    consentRecordId: "consent_01",
    worldKey: "pixel-digital",
    name: "Alex Dupont",
    email: "alex@example.com",
    message: "Bonjour, je souhaite un devis.",
    sourcePage: "/contact",
    idempotencyKey: "idem_01",
    consentGiven: true,
    honeypot: "",
  };
}

let enquiries: InMemoryEnquiryRepository;
let worlds: InMemoryWorldRepository;
let services: InMemoryServiceRepository;
let dependencies: EnquiryDependencies;

beforeEach(() => {
  enquiries = new InMemoryEnquiryRepository();
  worlds = new InMemoryWorldRepository([validWorld()]);
  services = new InMemoryServiceRepository();
  dependencies = { enquiries, worlds, services, clock: fixedClock() };
});

describe("submitGeneralContact", () => {
  it("accepts a valid submission and persists an enquiry with consent", async () => {
    const result = await submitGeneralContact(dependencies, validInput());

    expect(result).toMatchObject({
      ok: true,
      value: { receiptId: "enquiry_01" },
    });
    expect(enquiries.savedEnquiries).toHaveLength(1);
    expect(enquiries.savedEnquiries[0]).toMatchObject({
      abuseStatus: "ACCEPTED",
      serviceId: null,
    });
    expect(enquiries.savedConsents).toHaveLength(1);
    expect(enquiries.savedConsents[0]).toMatchObject({
      purposeKey: "general_contact",
      response: true,
    });
  });

  it("returns the existing receipt for a repeated idempotency key", async () => {
    await submitGeneralContact(dependencies, validInput());
    const result = await submitGeneralContact(dependencies, {
      ...validInput(),
      id: "enquiry_02",
    });

    expect(result).toMatchObject({
      ok: true,
      value: { receiptId: "enquiry_01" },
    });
    expect(enquiries.savedEnquiries).toHaveLength(1);
  });

  it("returns NOT_FOUND for an unknown world", async () => {
    const result = await submitGeneralContact(dependencies, {
      ...validInput(),
      worldKey: "missing-world",
    });

    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("returns VALIDATION_ERROR when consent is not given", async () => {
    const result = await submitGeneralContact(dependencies, {
      ...validInput(),
      consentGiven: false,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", validationCode: "INVALID_RESPONSE" },
    });
  });

  it("silently flags a honeypot submission but still returns a receipt", async () => {
    const result = await submitGeneralContact(dependencies, {
      ...validInput(),
      honeypot: "http://spam.example",
    });

    expect(result).toMatchObject({
      ok: true,
      value: { receiptId: "enquiry_01" },
    });
    expect(enquiries.savedEnquiries[0]).toMatchObject({
      abuseStatus: "FLAGGED",
    });
  });

  it("resolves a published serviceSlug to its serviceId", async () => {
    const service = await createPublishedService();

    const result = await submitGeneralContact(dependencies, {
      ...validInput(),
      serviceSlug: service.slug,
    });

    expect(result).toMatchObject({ ok: true });
    expect(enquiries.savedEnquiries[0]).toMatchObject({
      serviceId: service.id,
    });
  });

  it("returns VALIDATION_ERROR for an unpublished serviceSlug", async () => {
    const result = await submitGeneralContact(dependencies, {
      ...validInput(),
      serviceSlug: "does-not-exist",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", validationCode: "INVALID_SERVICE_ID" },
    });
  });

  it("rate limits repeated submissions from the same email", async () => {
    for (let i = 0; i < 3; i += 1) {
      const result = await submitGeneralContact(dependencies, {
        ...validInput(),
        id: `enquiry_${i}`,
        idempotencyKey: `idem_${i}`,
      });
      expect(result.ok).toBe(true);
    }

    const result = await submitGeneralContact(dependencies, {
      ...validInput(),
      id: "enquiry_04",
      idempotencyKey: "idem_04",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "RATE_LIMITED" },
    });
  });
});

async function createPublishedService() {
  const created = await createDraftService(
    { services, worlds },
    systemContext(),
    {
      id: "service_01",
      worldKey: "pixel-digital",
      name: "Création de logo",
      slug: "creation-de-logo",
      description: "Conception de logo sur mesure.",
      availabilityStatus: "CURRENT_STATED",
    },
  );
  if (!created.ok) throw new Error("expected service creation to succeed");

  const approved = await approveServiceAsCurrent(
    { services, worlds },
    systemContext(),
    { id: created.value.id, expectedVersion: created.value.version },
  );
  if (!approved.ok) throw new Error("expected approval to succeed");

  const submitted = await submitServiceForReview(
    { services, worlds },
    systemContext(),
    { id: approved.value.id, expectedVersion: approved.value.version },
  );
  if (!submitted.ok) throw new Error("expected submission to succeed");

  const published = publishService(submitted.value, now);
  if (!published.ok) throw new Error("expected publication to succeed");
  await services.save(published.value);

  return published.value;
}

function systemContext() {
  const scopes: readonly AuthorizationScope[] = [{ type: "GLOBAL" }];
  const role: ApprovedRole = "SUPER_ADMIN";
  return {
    actor: { id: "system", active: true, role, scopes },
    correlationId: "test",
    clock: fixedClock(),
    origin: { channel: "SYSTEM" as const },
  };
}
