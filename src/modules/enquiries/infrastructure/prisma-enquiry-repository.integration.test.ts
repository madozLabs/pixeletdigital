import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createWorld } from "@/modules/worlds/domain/world";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { createConsentRecord } from "../domain/consent-record";
import { createGeneralEnquiry, type Enquiry } from "../domain/enquiry";
import { PrismaEnquiryRepository } from "./prisma-enquiry-repository";

let client: PrismaClient;
let repository: PrismaEnquiryRepository;
let worlds: PrismaWorldRepository;

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL is required for database integration tests.",
    );
  }
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  repository = new PrismaEnquiryRepository(client);
  worlds = new PrismaWorldRepository(client);

  await worlds.save(validWorld());
});

afterAll(async () => {
  await client.$disconnect();
});

describe("PrismaEnquiryRepository", () => {
  it("persists an enquiry with its consent record and finds it by idempotency key", async () => {
    const enquiry = draftEnquiry({
      id: "enquiry_test_01",
      idempotencyKey: "idem_test_01",
    });
    const consent = draftConsent(enquiry.id, "consent_test_01");

    await repository.save(enquiry, consent);
    const found = await repository.findByIdempotencyKey("idem_test_01");

    expect(found).toEqual(enquiry);
  });

  it("returns null for an unknown idempotency key", async () => {
    expect(await repository.findByIdempotencyKey("missing-key")).toBeNull();
  });

  it("counts recent submissions from the same email within the window", async () => {
    const email = "recent@example.com";
    const submittedAt = new Date("2026-07-22T12:00:00.000Z");

    await repository.save(
      draftEnquiry({
        id: "enquiry_test_02",
        idempotencyKey: "idem_test_02",
        email,
        submittedAt,
      }),
      draftConsent("enquiry_test_02", "consent_test_02"),
    );
    await repository.save(
      draftEnquiry({
        id: "enquiry_test_03",
        idempotencyKey: "idem_test_03",
        email,
        submittedAt,
      }),
      draftConsent("enquiry_test_03", "consent_test_03"),
    );

    const count = await repository.countRecentByEmail(
      "content-enquiries-test-world",
      email,
      new Date("2026-07-22T11:55:00.000Z"),
    );

    expect(count).toBe(2);
  });

  it("excludes submissions outside the rate-limit window", async () => {
    const email = "old@example.com";

    await repository.save(
      draftEnquiry({
        id: "enquiry_test_04",
        idempotencyKey: "idem_test_04",
        email,
        submittedAt: new Date("2026-07-22T08:00:00.000Z"),
      }),
      draftConsent("enquiry_test_04", "consent_test_04"),
    );

    const count = await repository.countRecentByEmail(
      "content-enquiries-test-world",
      email,
      new Date("2026-07-22T11:55:00.000Z"),
    );

    expect(count).toBe(0);
  });

  it("rejects an enquiry referencing an unknown world key", async () => {
    const orphan = draftEnquiry({
      id: "enquiry_test_05",
      idempotencyKey: "idem_test_05",
      worldKey: "missing-world",
    });

    await expect(
      repository.save(orphan, draftConsent(orphan.id, "consent_test_05")),
    ).rejects.toThrow();
  });
});

function validWorld() {
  const now = new Date("2026-07-15T00:00:00.000Z");
  const result = createWorld({
    id: "world_enquiry_test",
    key: "content-enquiries-test-world",
    displayName: "Enquiries Test World",
    mode: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function draftEnquiry(
  overrides: Partial<{
    id: string;
    worldKey: string;
    email: string;
    idempotencyKey: string;
    submittedAt: Date;
  }> = {},
): Enquiry {
  const result = createGeneralEnquiry({
    id: overrides.id ?? "enquiry_test_default",
    worldKey: overrides.worldKey ?? "content-enquiries-test-world",
    name: "Alex Dupont",
    email: overrides.email ?? "alex@example.com",
    message: "Bonjour, je souhaite un devis.",
    sourcePage: "/contact",
    idempotencyKey: overrides.idempotencyKey ?? "idem_test_default",
    abuseStatus: "ACCEPTED",
    submittedAt: overrides.submittedAt ?? new Date("2026-07-22T00:00:00.000Z"),
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function draftConsent(enquiryId: string, id: string) {
  const result = createConsentRecord({
    id,
    enquiryId,
    purposeKey: "general_contact",
    version: 1,
    response: true,
    source: "contact_form",
    capturedAt: new Date("2026-07-22T00:00:00.000Z"),
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
