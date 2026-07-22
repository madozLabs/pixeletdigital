import { describe, expect, it } from "vitest";

import { createConsentRecord } from "./consent-record";

const now = new Date("2026-07-22T00:00:00.000Z");

function validInput() {
  return {
    id: "consent_01",
    enquiryId: "enquiry_01",
    purposeKey: "general_contact",
    version: 1,
    response: true,
    source: "contact_form",
    capturedAt: now,
  };
}

describe("createConsentRecord", () => {
  it("creates a valid consent record", () => {
    const result = createConsentRecord(validInput());

    expect(result).toMatchObject({
      ok: true,
      value: { purposeKey: "general_contact", version: 1, response: true },
    });
  });

  it("rejects a non-affirmative response", () => {
    const result = createConsentRecord({ ...validInput(), response: false });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_RESPONSE" },
    });
  });

  it("rejects a non-positive version", () => {
    const result = createConsentRecord({ ...validInput(), version: 0 });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_VERSION" },
    });
  });

  it("rejects an empty purposeKey", () => {
    const result = createConsentRecord({ ...validInput(), purposeKey: " " });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_PURPOSE_KEY" },
    });
  });
});
