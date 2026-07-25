import { describe, expect, it } from "vitest";

import { createLeadNote } from "./lead-note";

const now = new Date("2026-07-25T00:00:00.000Z");

function validInput() {
  return {
    id: "lead_note_1",
    leadId: "lead_1",
    authorId: "user_1",
    body: "Called back, waiting on budget confirmation.",
    createdAt: now,
  };
}

describe("createLeadNote", () => {
  it("creates a note", () => {
    const result = createLeadNote(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.body).toBe(
      "Called back, waiting on budget confirmation.",
    );
  });

  it("rejects an empty body", () => {
    const result = createLeadNote({ ...validInput(), body: "   " });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_BODY");
  });

  it("rejects a body over 2000 characters", () => {
    const result = createLeadNote({
      ...validInput(),
      body: "a".repeat(2001),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_BODY");
  });

  it("rejects an empty leadId", () => {
    const result = createLeadNote({ ...validInput(), leadId: "  " });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_LEAD_ID");
  });
});
