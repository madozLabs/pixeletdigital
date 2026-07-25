import { describe, expect, it } from "vitest";

import type { Clock } from "@/shared/clock";
import type {
  ApprovedRole,
  AuthorizationScope,
  RequestContext,
} from "@/shared/request-context";

import { createLead } from "../domain/lead";
import {
  addLeadNote,
  assignLead,
  completeNextAction,
  createLeadFromEnquiry,
  getLeadById,
  listLeadsByWorld,
  setNextAction,
  updateLeadStatus,
} from "./lead-use-cases";
import { InMemoryLeadRepository } from "./testing/in-memory-lead-repository";

const createdAt = new Date("2026-07-20T08:00:00.000Z");
const clockTime = new Date("2026-07-25T10:30:00.000Z");

function context(
  role: ApprovedRole,
  scopes: readonly AuthorizationScope[],
): RequestContext {
  const clock: Clock = { now: () => clockTime };
  return {
    actor: { id: "actor_01", active: true, role, scopes },
    correlationId: "test-correlation-id",
    clock,
    origin: { channel: "WORKSPACE" },
  };
}

function seededLead(overrides: Partial<Parameters<typeof createLead>[0]> = {}) {
  const result = createLead({
    id: "lead_1",
    worldKey: "pixel-digital",
    name: "Awa Traoré",
    email: "awa@example.com",
    phone: null,
    source: "contact_form",
    createdAt,
    ...overrides,
  });
  if (!result.ok) throw new Error("fixture should be valid");
  return result.value;
}

describe("createLeadFromEnquiry", () => {
  it("creates a NEW lead linked to the enquiry", async () => {
    const leads = new InMemoryLeadRepository();

    const result = await createLeadFromEnquiry(
      { leads },
      {
        enquiryId: "enquiry_1",
        worldKey: "pixel-digital",
        name: "Awa Traoré",
        email: "awa@example.com",
        source: "contact_form",
        now: createdAt,
      },
    );

    expect(result).toMatchObject({ ok: true, value: { status: "NEW" } });
    expect(leads.savedLeads).toHaveLength(1);
    const linked = await leads.findByEnquiryId("enquiry_1");
    expect(linked?.id).toBe(leads.savedLeads[0]?.id);
  });

  it("is idempotent: resubmitting the same enquiry does not create a second lead", async () => {
    const leads = new InMemoryLeadRepository();
    const input = {
      enquiryId: "enquiry_1",
      worldKey: "pixel-digital",
      name: "Awa Traoré",
      email: "awa@example.com",
      source: "contact_form",
      now: createdAt,
    };

    const first = await createLeadFromEnquiry({ leads }, input);
    const second = await createLeadFromEnquiry({ leads }, input);

    expect(leads.savedLeads).toHaveLength(1);
    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({
      ok: true,
      value: { id: leads.savedLeads[0]?.id },
    });
  });

  it("records a CREATED activity", async () => {
    const leads = new InMemoryLeadRepository();

    const result = await createLeadFromEnquiry(
      { leads },
      {
        enquiryId: "enquiry_1",
        worldKey: "pixel-digital",
        name: "Awa Traoré",
        email: "awa@example.com",
        source: "contact_form",
        now: createdAt,
      },
    );
    if (!result.ok) throw new Error("fixture should succeed");

    const activities = await leads.listActivities(result.value.id);
    expect(activities).toHaveLength(1);
    expect(activities[0]?.type).toBe("CREATED");
  });
});

describe("listLeadsByWorld / getLeadById authorization", () => {
  it.each<ApprovedRole>(["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER", "SALES"])(
    "allows %s with a matching world scope",
    async (role) => {
      const leads = new InMemoryLeadRepository([seededLead()]);

      const result = await listLeadsByWorld(
        { leads },
        context(role, [{ type: "WORLD", worldKey: "pixel-digital" }]),
        { worldKey: "pixel-digital" },
      );

      expect(result).toMatchObject({ ok: true, value: [{ id: "lead_1" }] });
    },
  );

  it.each<ApprovedRole>(["EDITOR", "CONTRIBUTOR", "READER"])(
    "denies %s even with world scope",
    async (role) => {
      const leads = new InMemoryLeadRepository([seededLead()]);

      const result = await listLeadsByWorld(
        { leads },
        context(role, [{ type: "GLOBAL" }]),
        { worldKey: "pixel-digital" },
      );

      expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    },
  );

  it("denies a world-scoped actor for a different world", async () => {
    const leads = new InMemoryLeadRepository([seededLead()]);

    const result = await getLeadById(
      { leads },
      context("SALES", [{ type: "WORLD", worldKey: "kwaliti-print" }]),
      { id: "lead_1" },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("returns NOT_FOUND for an unknown lead", async () => {
    const leads = new InMemoryLeadRepository();

    const result = await getLeadById(
      { leads },
      context("ADMIN", [{ type: "GLOBAL" }]),
      { id: "missing" },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });
});

describe("updateLeadStatus", () => {
  it("moves a lead from NEW to IN_REVIEW and records activity", async () => {
    const leads = new InMemoryLeadRepository([seededLead()]);

    const result = await updateLeadStatus(
      { leads },
      context("SALES", [{ type: "GLOBAL" }]),
      { id: "lead_1", expectedVersion: 1, status: "IN_REVIEW" },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { status: "IN_REVIEW", version: 2 },
    });
    const activities = await leads.listActivities("lead_1");
    expect(activities.at(-1)?.type).toBe("STATUS_CHANGED");
  });

  it("rejects a stale expectedVersion with CONFLICT", async () => {
    const leads = new InMemoryLeadRepository([seededLead()]);

    const result = await updateLeadStatus(
      { leads },
      context("SALES", [{ type: "GLOBAL" }]),
      { id: "lead_1", expectedVersion: 99, status: "IN_REVIEW" },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("rejects an invalid transition as a validation error", async () => {
    const leads = new InMemoryLeadRepository([seededLead()]);

    const result = await updateLeadStatus(
      { leads },
      context("SALES", [{ type: "GLOBAL" }]),
      { id: "lead_1", expectedVersion: 1, status: "QUALIFIED" },
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", validationCode: "INVALID_TRANSITION" },
    });
  });
});

describe("assignLead", () => {
  it("assigns an owner", async () => {
    const leads = new InMemoryLeadRepository([seededLead()]);

    const result = await assignLead(
      { leads },
      context("ADMIN", [{ type: "GLOBAL" }]),
      { id: "lead_1", expectedVersion: 1, ownerUserId: "user_1" },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { ownerUserId: "user_1" },
    });
  });
});

describe("addLeadNote", () => {
  it("adds a note authored by the acting user", async () => {
    const leads = new InMemoryLeadRepository([seededLead()]);

    const result = await addLeadNote(
      { leads },
      context("SALES", [{ type: "GLOBAL" }]),
      { leadId: "lead_1", body: "Called, left voicemail." },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { authorId: "actor_01", body: "Called, left voicemail." },
    });
  });

  it("rejects an empty note body", async () => {
    const leads = new InMemoryLeadRepository([seededLead()]);

    const result = await addLeadNote(
      { leads },
      context("SALES", [{ type: "GLOBAL" }]),
      { leadId: "lead_1", body: "   " },
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", validationCode: "INVALID_BODY" },
    });
  });
});

describe("setNextAction / completeNextAction", () => {
  it("sets a next action and later completes it", async () => {
    const leads = new InMemoryLeadRepository([seededLead()]);

    const created = await setNextAction(
      { leads },
      context("SALES", [{ type: "GLOBAL" }]),
      {
        leadId: "lead_1",
        ownerUserId: "user_1",
        description: "Send quotation",
        dueDate: new Date("2026-08-01T00:00:00.000Z"),
      },
    );
    expect(created).toMatchObject({ ok: true, value: { status: "PENDING" } });
    if (!created.ok) return;

    const completed = await completeNextAction(
      { leads },
      context("SALES", [{ type: "GLOBAL" }]),
      { leadId: "lead_1", nextActionId: created.value.id },
    );

    expect(completed).toMatchObject({
      ok: true,
      value: { status: "COMPLETED" },
    });
  });

  it("returns NOT_FOUND when completing a next action from another lead", async () => {
    const leads = new InMemoryLeadRepository([
      seededLead(),
      seededLead({ id: "lead_2" }),
    ]);
    const created = await setNextAction(
      { leads },
      context("SALES", [{ type: "GLOBAL" }]),
      {
        leadId: "lead_1",
        ownerUserId: "user_1",
        description: "Send quotation",
        dueDate: new Date("2026-08-01T00:00:00.000Z"),
      },
    );
    if (!created.ok) throw new Error("fixture should succeed");

    const result = await completeNextAction(
      { leads },
      context("SALES", [{ type: "GLOBAL" }]),
      { leadId: "lead_2", nextActionId: created.value.id },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });
});
