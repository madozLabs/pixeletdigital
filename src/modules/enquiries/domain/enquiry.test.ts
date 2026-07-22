import { describe, expect, it } from "vitest";

import { createGeneralEnquiry } from "./enquiry";

const now = new Date("2026-07-22T00:00:00.000Z");

function validInput() {
  return {
    id: "enquiry_01",
    worldKey: "pixel-digital",
    name: "Alex Dupont",
    email: "Alex.Dupont@Example.com",
    message: "Bonjour, je souhaite un devis pour un site vitrine.",
    sourcePage: "/contact",
    idempotencyKey: "idem_01",
    abuseStatus: "ACCEPTED",
    submittedAt: now,
  };
}

describe("createGeneralEnquiry", () => {
  it("creates a valid general enquiry", () => {
    const result = createGeneralEnquiry(validInput());

    expect(result).toMatchObject({
      ok: true,
      value: {
        type: "GENERAL",
        worldKey: "pixel-digital",
        serviceId: null,
        email: "alex.dupont@example.com",
        phone: null,
      },
    });
  });

  it("normalizes and accepts an optional serviceId and phone", () => {
    const result = createGeneralEnquiry({
      ...validInput(),
      serviceId: "service_01",
      phone: "+33 6 12 34 56 78",
    });

    expect(result).toMatchObject({
      ok: true,
      value: { serviceId: "service_01", phone: "+33 6 12 34 56 78" },
    });
  });

  it("rejects an empty name", () => {
    const result = createGeneralEnquiry({ ...validInput(), name: "   " });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_NAME" },
    });
  });

  it.each(["not-an-email", "missing@domain", "@nouser.com", ""])(
    "rejects an invalid email %s",
    (email) => {
      const result = createGeneralEnquiry({ ...validInput(), email });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "INVALID_EMAIL" },
      });
    },
  );

  it("rejects an invalid phone", () => {
    const result = createGeneralEnquiry({
      ...validInput(),
      phone: "call me maybe",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_PHONE" },
    });
  });

  it("rejects an empty message", () => {
    const result = createGeneralEnquiry({ ...validInput(), message: "   " });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_MESSAGE" },
    });
  });

  it("rejects a message beyond the maximum length", () => {
    const result = createGeneralEnquiry({
      ...validInput(),
      message: "a".repeat(4001),
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_MESSAGE" },
    });
  });

  it("rejects an empty idempotency key", () => {
    const result = createGeneralEnquiry({
      ...validInput(),
      idempotencyKey: "  ",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_IDEMPOTENCY_KEY" },
    });
  });

  it("rejects an unknown abuse status", () => {
    const result = createGeneralEnquiry({
      ...validInput(),
      abuseStatus: "UNKNOWN",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_ABUSE_STATUS" },
    });
  });
});
