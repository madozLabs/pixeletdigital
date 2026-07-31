import { describe, expect, it } from "vitest";

import {
  archiveExpenseCategory,
  createExpenseCategory,
  restoreExpenseCategory,
} from "./expense-category";

const now = new Date("2026-07-31T00:00:00.000Z");

describe("createExpenseCategory", () => {
  it("creates an ACTIVE category with version 1", () => {
    const result = createExpenseCategory(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("ACTIVE");
    expect(result.value.version).toBe(1);
  });

  it("rejects an empty label", () => {
    const result = createExpenseCategory({ ...validInput(), label: "  " });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_LABEL");
  });
});

describe("archiveExpenseCategory", () => {
  it("transitions ACTIVE to ARCHIVED", () => {
    const created = createExpenseCategory(validInput());
    if (!created.ok) throw new Error("expected a valid category");

    const result = archiveExpenseCategory(created.value, now);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("ARCHIVED");
    expect(result.value.version).toBe(2);
  });

  it("rejects archiving an already-archived category", () => {
    const created = createExpenseCategory(validInput());
    if (!created.ok) throw new Error("expected a valid category");
    const archived = archiveExpenseCategory(created.value, now);
    if (!archived.ok) throw new Error("expected archive to succeed");

    const result = archiveExpenseCategory(archived.value, now);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TRANSITION");
  });
});

describe("restoreExpenseCategory", () => {
  it("round-trips a persisted category", () => {
    const created = createExpenseCategory(validInput());
    if (!created.ok) throw new Error("expected a valid category");

    const result = restoreExpenseCategory(created.value);

    expect(result).toEqual({ ok: true, value: created.value });
  });
});

function validInput() {
  return {
    id: "expense_category_test_01",
    label: "Marketing & Publicité",
    createdAt: now,
    updatedAt: now,
  };
}
