import { describe, expect, it } from "vitest";

import {
  assignLeadOwner,
  createLead,
  restoreLead,
  setLeadStatus,
} from "./lead";

const now = new Date("2026-07-25T00:00:00.000Z");

function validInput() {
  return {
    id: "lead_1",
    worldKey: "pixel-digital",
    name: "Awa Traoré",
    email: "Awa@Example.com",
    phone: "+225 07 00 00 00",
    source: "contact_form",
    createdAt: now,
  };
}

describe("createLead", () => {
  it("creates a NEW lead with no owner", () => {
    const result = createLead(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("NEW");
    expect(result.value.ownerUserId).toBeNull();
    expect(result.value.closedOutcome).toBeNull();
    expect(result.value.version).toBe(1);
  });

  it("normalizes email to lowercase", () => {
    const result = createLead(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.email).toBe("awa@example.com");
  });

  it("rejects an invalid email", () => {
    const result = createLead({ ...validInput(), email: "not-an-email" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_EMAIL");
  });

  it("rejects an empty source", () => {
    const result = createLead({ ...validInput(), source: "  " });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_SOURCE");
  });

  it("treats a blank phone as absent", () => {
    const result = createLead({ ...validInput(), phone: "   " });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phone).toBeNull();
  });
});

describe("setLeadStatus", () => {
  function newLead() {
    const result = createLead(validInput());
    if (!result.ok) throw new Error("fixture should be valid");
    return result.value;
  }

  it("allows NEW -> IN_REVIEW", () => {
    const result = setLeadStatus(newLead(), "IN_REVIEW", now);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("IN_REVIEW");
    expect(result.value.version).toBe(2);
  });

  it("rejects skipping straight from NEW to QUALIFIED", () => {
    const result = setLeadStatus(newLead(), "QUALIFIED", now);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TRANSITION");
  });

  it("allows IN_REVIEW -> QUALIFIED", () => {
    const inReview = mustTransition(newLead(), "IN_REVIEW");
    const result = setLeadStatus(inReview, "QUALIFIED", now);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("QUALIFIED");
  });

  it("allows IN_REVIEW -> UNQUALIFIED", () => {
    const inReview = mustTransition(newLead(), "IN_REVIEW");
    const result = setLeadStatus(inReview, "UNQUALIFIED", now);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("UNQUALIFIED");
  });

  it("requires a closedOutcome when closing a lead", () => {
    const qualified = mustTransition(
      mustTransition(newLead(), "IN_REVIEW"),
      "QUALIFIED",
    );
    const result = setLeadStatus(qualified, "CLOSED", now);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_CLOSED_OUTCOME");
  });

  it("closes a qualified lead with an outcome", () => {
    const qualified = mustTransition(
      mustTransition(newLead(), "IN_REVIEW"),
      "QUALIFIED",
    );
    const result = setLeadStatus(
      qualified,
      "CLOSED",
      now,
      "Converted to client",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("CLOSED");
    expect(result.value.closedOutcome).toBe("Converted to client");
  });

  it("rejects any transition once a lead is closed", () => {
    const qualified = mustTransition(
      mustTransition(newLead(), "IN_REVIEW"),
      "QUALIFIED",
    );
    const closedResult = setLeadStatus(qualified, "CLOSED", now, "Won");
    if (!closedResult.ok) throw new Error("fixture should close");

    const result = setLeadStatus(closedResult.value, "IN_REVIEW", now);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TRANSITION");
  });

  function mustTransition(lead: ReturnType<typeof newLead>, status: string) {
    const result = setLeadStatus(lead, status, now);
    if (!result.ok) throw new Error(`fixture transition to ${status} failed`);
    return result.value;
  }
});

describe("assignLeadOwner", () => {
  it("assigns an owner and bumps the version", () => {
    const created = createLead(validInput());
    if (!created.ok) throw new Error("fixture should be valid");

    const result = assignLeadOwner(created.value, "user_1", now);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ownerUserId).toBe("user_1");
    expect(result.value.version).toBe(2);
  });

  it("rejects reassigning a closed lead", () => {
    const created = createLead(validInput());
    if (!created.ok) throw new Error("fixture should be valid");
    const review = setLeadStatus(created.value, "IN_REVIEW", now);
    if (!review.ok) throw new Error("fixture should transition");
    const qualified = setLeadStatus(review.value, "QUALIFIED", now);
    if (!qualified.ok) throw new Error("fixture should transition");
    const closed = setLeadStatus(qualified.value, "CLOSED", now, "Lost");
    if (!closed.ok) throw new Error("fixture should close");

    const result = assignLeadOwner(closed.value, "user_2", now);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TRANSITION");
  });
});

describe("restoreLead", () => {
  it("rejects an unknown status", () => {
    const result = restoreLead({
      id: "lead_1",
      worldKey: "pixel-digital",
      name: "Awa",
      email: "awa@example.com",
      phone: null,
      source: "contact_form",
      status: "SOMETHING_ELSE",
      ownerUserId: null,
      closedOutcome: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_STATUS");
  });

  it("restores a persisted lead", () => {
    const result = restoreLead({
      id: "lead_1",
      worldKey: "pixel-digital",
      name: "Awa",
      email: "awa@example.com",
      phone: null,
      source: "contact_form",
      status: "QUALIFIED",
      ownerUserId: "user_1",
      closedOutcome: null,
      version: 3,
      createdAt: now,
      updatedAt: now,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("QUALIFIED");
    expect(result.value.version).toBe(3);
  });
});
