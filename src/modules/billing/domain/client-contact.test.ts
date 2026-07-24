import { describe, expect, it } from "vitest";

import { createClientContact, restoreClientContact } from "./client-contact";

const now = new Date("2026-07-23T00:00:00.000Z");

describe("createClientContact", () => {
  it("creates a valid contact", () => {
    const result = createClientContact(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Jane Doe");
    expect(result.value.isPrimary).toBe(false);
  });

  it("rejects an empty name", () => {
    const result = createClientContact({ ...validInput(), name: "  " });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_NAME");
  });

  it("rejects an invalid email", () => {
    const result = createClientContact({
      ...validInput(),
      email: "not-an-email",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_EMAIL");
  });
});

describe("restoreClientContact", () => {
  it("round-trips a persisted contact", () => {
    const created = createClientContact(validInput());
    if (!created.ok) throw new Error("expected a valid contact");

    const result = restoreClientContact(created.value);

    expect(result).toEqual({ ok: true, value: created.value });
  });
});

function validInput() {
  return {
    id: "contact_test_01",
    clientId: "client_test_01",
    name: "Jane Doe",
    role: "Directrice marketing",
    email: "jane@example.com",
    isPrimary: false,
    createdAt: now,
    updatedAt: now,
  };
}
