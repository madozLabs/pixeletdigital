import { describe, expect, it } from "vitest";

import {
  archiveClient,
  createClient,
  editClient,
  restoreClient,
} from "./client";

const now = new Date("2026-07-23T00:00:00.000Z");

describe("createClient", () => {
  it("creates an ACTIVE client with version 1", () => {
    const result = createClient(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("ACTIVE");
    expect(result.value.version).toBe(1);
  });

  it("rejects an empty name", () => {
    const result = createClient(validInput({ name: "  " }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_NAME");
  });

  it("rejects an invalid email", () => {
    const result = createClient({ ...validInput(), email: "not-an-email" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_EMAIL");
  });

  it("allows a missing email", () => {
    const result = createClient({ ...validInput(), email: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.email).toBeNull();
  });
});

describe("editClient", () => {
  it("updates fields and bumps version", () => {
    const created = createClient(validInput());
    if (!created.ok) throw new Error("expected a valid client");

    const result = editClient(
      created.value,
      { name: "New Name", email: "new@example.com" },
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("New Name");
    expect(result.value.version).toBe(2);
  });
});

describe("archiveClient", () => {
  it("transitions ACTIVE to ARCHIVED", () => {
    const created = createClient(validInput());
    if (!created.ok) throw new Error("expected a valid client");

    const result = archiveClient(created.value, now);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("ARCHIVED");
  });

  it("rejects archiving an already-archived client", () => {
    const created = createClient(validInput());
    if (!created.ok) throw new Error("expected a valid client");
    const archived = archiveClient(created.value, now);
    if (!archived.ok) throw new Error("expected archive to succeed");

    const result = archiveClient(archived.value, now);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TRANSITION");
  });
});

describe("restoreClient", () => {
  it("round-trips a persisted client", () => {
    const created = createClient(validInput());
    if (!created.ok) throw new Error("expected a valid client");

    const result = restoreClient(created.value);

    expect(result).toEqual({ ok: true, value: created.value });
  });
});

function validInput(
  overrides: Partial<{ name: string; email: string | null }> = {},
) {
  return {
    id: "client_test_01",
    worldKey: "pixel-digital",
    name: overrides.name ?? "Client A",
    email: overrides.email ?? "client@example.com",
    createdAt: now,
    updatedAt: now,
  };
}
