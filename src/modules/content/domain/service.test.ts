import { describe, expect, it } from "vitest";

import {
  approveServiceAsCurrent,
  archiveService,
  createDraftService,
  editDraftService,
  publishService,
  rejectService,
  revokeServiceApproval,
  setServiceAvailability,
  submitServiceForReview,
} from "./service";

const now = new Date("2026-07-15T00:00:00.000Z");
const later = new Date("2026-07-16T00:00:00.000Z");

function validInput() {
  return {
    id: "service_01",
    worldKey: "kwaliti-print",
    name: "Personalized Gadgets",
    slug: "personalized-gadgets",
    description: "Custom-printed promotional gadgets.",
    availabilityStatus: "CURRENT_STATED",
    createdAt: now,
    updatedAt: now,
  };
}

function draftService() {
  const result = createDraftService(validInput());
  if (!result.ok) throw new Error("expected a valid draft service");
  return result.value;
}

describe("createDraftService", () => {
  it.each(["CANDIDATE", "CURRENT_STATED", "FUTURE_ONLY"])(
    "accepts the creatable availability status %s",
    (availabilityStatus) => {
      const result = createDraftService({
        ...validInput(),
        availabilityStatus,
      });

      expect(result).toMatchObject({
        ok: true,
        value: { lifecycle: "DRAFT", version: 1, availabilityStatus },
      });
    },
  );

  it.each(["APPROVED_CURRENT", "WITHDRAWN", "UNKNOWN"])(
    "rejects creating a service directly as %s",
    (availabilityStatus) => {
      const result = createDraftService({
        ...validInput(),
        availabilityStatus,
      });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "INVALID_AVAILABILITY_STATUS" },
      });
    },
  );

  it("defaults familyId to null when absent", () => {
    const result = createDraftService(validInput());

    expect(result).toMatchObject({ ok: true, value: { familyId: null } });
  });

  it("rejects an empty name", () => {
    const result = createDraftService({ ...validInput(), name: "   " });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_NAME" },
    });
  });

  it("rejects an empty description", () => {
    const result = createDraftService({ ...validInput(), description: "   " });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_DESCRIPTION" },
    });
  });

  it.each([
    "Personalized Gadgets",
    "-gadgets",
    "gadgets-",
    "gadgets publicitaires",
  ])("rejects an invalid slug %s", (slug) => {
    const result = createDraftService({ ...validInput(), slug });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_SLUG" },
    });
  });
});

describe("editDraftService", () => {
  it("updates name and description and bumps the version", () => {
    const result = editDraftService(
      draftService(),
      {
        name: "Gadgets personnalisés",
        slug: "gadgets-personnalises",
        description: "Nouveaux gadgets.",
      },
      later,
    );

    expect(result).toMatchObject({
      ok: true,
      value: { name: "Gadgets personnalisés", version: 2 },
    });
  });

  it("rejects editing a service that is not a draft", () => {
    const submitted = submitServiceForReview(draftService(), later);
    if (!submitted.ok) throw new Error("expected submission to succeed");

    const result = editDraftService(
      submitted.value,
      { name: "X", slug: "x", description: "Y" },
      later,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_TRANSITION" },
    });
  });
});

describe("setServiceAvailability", () => {
  it.each(["CANDIDATE", "FUTURE_ONLY", "WITHDRAWN"])(
    "moves a service to the editable status %s",
    (status) => {
      const result = setServiceAvailability(draftService(), status, later);

      expect(result).toMatchObject({
        ok: true,
        value: { availabilityStatus: status },
      });
    },
  );

  it("rejects setting APPROVED_CURRENT directly", () => {
    const result = setServiceAvailability(
      draftService(),
      "APPROVED_CURRENT",
      later,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_AVAILABILITY_STATUS" },
    });
  });

  it("rejects editing availability while APPROVED_CURRENT", () => {
    const approved = approveServiceAsCurrent(draftService(), later);
    if (!approved.ok) throw new Error("expected approval to succeed");

    const result = setServiceAvailability(approved.value, "WITHDRAWN", later);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_TRANSITION" },
    });
  });
});

describe("approveServiceAsCurrent and revokeServiceApproval", () => {
  it("approves a CURRENT_STATED service", () => {
    const result = approveServiceAsCurrent(draftService(), later);

    expect(result).toMatchObject({
      ok: true,
      value: { availabilityStatus: "APPROVED_CURRENT", version: 2 },
    });
  });

  it("rejects approving a service that is not CURRENT_STATED", () => {
    const candidate = createDraftService({
      ...validInput(),
      availabilityStatus: "CANDIDATE",
    });
    if (!candidate.ok) throw new Error("expected creation to succeed");

    const result = approveServiceAsCurrent(candidate.value, later);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_TRANSITION" },
    });
  });

  it("revokes an APPROVED_CURRENT service back to CURRENT_STATED", () => {
    const approved = approveServiceAsCurrent(draftService(), later);
    if (!approved.ok) throw new Error("expected approval to succeed");

    const result = revokeServiceApproval(approved.value, later);

    expect(result).toMatchObject({
      ok: true,
      value: { availabilityStatus: "CURRENT_STATED", version: 3 },
    });
  });

  it("rejects revoking a service that is not APPROVED_CURRENT", () => {
    const result = revokeServiceApproval(draftService(), later);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_TRANSITION" },
    });
  });
});

describe("service lifecycle transitions", () => {
  it("submits, publishes, and archives a service", () => {
    const inReview = submitServiceForReview(draftService(), later);
    if (!inReview.ok) throw new Error("expected submission to succeed");
    expect(inReview.value.lifecycle).toBe("IN_REVIEW");

    const published = publishService(inReview.value, later);
    if (!published.ok) throw new Error("expected publication to succeed");
    expect(published.value).toMatchObject({
      lifecycle: "PUBLISHED",
      publishedAt: later,
    });

    const archived = archiveService(published.value, later);
    expect(archived).toMatchObject({
      ok: true,
      value: { lifecycle: "ARCHIVED" },
    });
  });

  it("returns a rejected service back to DRAFT", () => {
    const inReview = submitServiceForReview(draftService(), later);
    if (!inReview.ok) throw new Error("expected submission to succeed");

    const result = rejectService(inReview.value, later);

    expect(result).toMatchObject({ ok: true, value: { lifecycle: "DRAFT" } });
  });
});
