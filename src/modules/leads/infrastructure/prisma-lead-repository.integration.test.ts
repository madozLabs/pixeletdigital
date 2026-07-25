import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createWorld } from "@/modules/worlds/domain/world";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { createLeadActivity } from "../domain/lead-activity";
import { createLead } from "../domain/lead";
import { createLeadNote } from "../domain/lead-note";
import { createNextAction } from "../domain/next-action";
import { PrismaLeadRepository } from "./prisma-lead-repository";

let client: PrismaClient;
let repository: PrismaLeadRepository;

const worldKey = "leads-test-world";
const userId = "user_leads_test";
const enquiryId = "enquiry_leads_test";

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL is required for database integration tests.",
    );
  }
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  repository = new PrismaLeadRepository(client);

  const worlds = new PrismaWorldRepository(client);
  const worldResult = createWorld({
    id: "world_leads_test",
    key: worldKey,
    displayName: "Leads Test World",
    mode: "ACTIVE",
    createdAt: new Date("2026-07-15T00:00:00.000Z"),
    updatedAt: new Date("2026-07-15T00:00:00.000Z"),
  });
  if (!worldResult.ok) throw new Error(worldResult.error.message);
  await worlds.save(worldResult.value);

  await client.user.create({
    data: {
      id: userId,
      displayName: "Test Owner",
      normalizedEmail: "test-owner@example.com",
      status: "ACTIVE",
    },
  });

  await client.enquiry.create({
    data: {
      id: enquiryId,
      type: "GENERAL",
      worldKey,
      name: "Awa Traoré",
      email: "awa@example.com",
      message: "Bonjour, je souhaite un devis.",
      sourcePage: "/contact",
      idempotencyKey: "idem_leads_test",
      abuseStatus: "ACCEPTED",
      submittedAt: new Date("2026-07-24T00:00:00.000Z"),
    },
  });
});

afterAll(async () => {
  // Other integration test files (e.g. authentication-activity) run a
  // blanket client.user.deleteMany() against this same shared database and
  // expect to own the User table; leaving this test's user/enquiry/lead rows
  // behind would block that delete via the Restrict FKs on LeadNote/NextAction.
  await client.leadActivity.deleteMany({ where: { leadId: { startsWith: "lead_test_" } } });
  await client.nextAction.deleteMany({ where: { leadId: { startsWith: "lead_test_" } } });
  await client.leadNote.deleteMany({ where: { leadId: { startsWith: "lead_test_" } } });
  await client.leadEnquiry.deleteMany({ where: { enquiryId } });
  await client.lead.deleteMany({ where: { worldKey } });
  await client.enquiry.deleteMany({ where: { id: enquiryId } });
  await client.user.deleteMany({ where: { id: userId } });
  await client.$disconnect();
});

describe("PrismaLeadRepository", () => {
  it("persists a lead and finds it by id", async () => {
    const lead = draftLead("lead_test_01");

    await repository.save(lead);
    const found = await repository.findById("lead_test_01");

    expect(found).toEqual(lead);
  });

  it("returns null for an unknown id", async () => {
    expect(await repository.findById("missing-lead")).toBeNull();
  });

  it("links a lead to its originating enquiry and finds it by enquiry id", async () => {
    const lead = draftLead("lead_test_02");
    await repository.save(lead);

    await repository.linkEnquiry(lead.id, enquiryId, new Date());
    const found = await repository.findByEnquiryId(enquiryId);

    expect(found?.id).toBe(lead.id);
  });

  it("updates status, owner and version on an existing lead", async () => {
    const lead = draftLead("lead_test_03");
    await repository.save(lead);

    const updated = {
      ...lead,
      status: "IN_REVIEW" as const,
      ownerUserId: userId,
      version: 2,
    };
    await repository.save(updated);
    const found = await repository.findById("lead_test_03");

    expect(found).toMatchObject({
      status: "IN_REVIEW",
      ownerUserId: userId,
      version: 2,
    });
  });

  it("lists leads for a world ordered by most recent first", async () => {
    const earlier = draftLead("lead_test_04", {
      createdAt: new Date("2026-07-20T09:00:00.000Z"),
    });
    const later = draftLead("lead_test_05", {
      createdAt: new Date("2026-07-20T10:00:00.000Z"),
    });
    await repository.save(earlier);
    await repository.save(later);

    const found = await repository.listByWorld(worldKey);
    const ids = found.map((lead) => lead.id);

    expect(ids.indexOf(later.id)).toBeLessThan(ids.indexOf(earlier.id));
  });

  it("adds and lists notes for a lead", async () => {
    const lead = draftLead("lead_test_06");
    await repository.save(lead);
    const noteResult = createLeadNote({
      id: "lead_note_test_01",
      leadId: lead.id,
      authorId: userId,
      body: "Left a voicemail.",
      createdAt: new Date(),
    });
    if (!noteResult.ok) throw new Error(noteResult.error.message);

    await repository.addNote(noteResult.value);
    const notes = await repository.listNotes(lead.id);

    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ body: "Left a voicemail." });
  });

  it("adds, finds and completes a next action", async () => {
    const lead = draftLead("lead_test_07");
    await repository.save(lead);
    const nextActionResult = createNextAction({
      id: "next_action_test_01",
      leadId: lead.id,
      ownerUserId: userId,
      description: "Send quotation",
      dueDate: new Date("2026-08-01T00:00:00.000Z"),
      createdAt: new Date(),
    });
    if (!nextActionResult.ok) throw new Error(nextActionResult.error.message);

    await repository.addNextAction(nextActionResult.value);
    const found = await repository.findNextActionById("next_action_test_01");
    expect(found).toMatchObject({ status: "PENDING" });

    await repository.updateNextAction({
      ...nextActionResult.value,
      status: "COMPLETED",
      completedAt: new Date("2026-07-25T12:00:00.000Z"),
    });
    const completed = await repository.findNextActionById(
      "next_action_test_01",
    );
    expect(completed).toMatchObject({ status: "COMPLETED" });

    const list = await repository.listNextActions(lead.id);
    expect(list).toHaveLength(1);
  });

  it("records and lists activities for a lead", async () => {
    const lead = draftLead("lead_test_08");
    await repository.save(lead);
    const activityResult = createLeadActivity({
      id: "lead_activity_test_01",
      leadId: lead.id,
      type: "CREATED",
      occurredAt: new Date(),
    });
    if (!activityResult.ok) throw new Error(activityResult.error.message);

    await repository.recordActivity(activityResult.value);
    const activities = await repository.listActivities(lead.id);

    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({ type: "CREATED" });
  });
});

function draftLead(id: string, overrides: Partial<{ createdAt: Date }> = {}) {
  const result = createLead({
    id,
    worldKey,
    name: "Awa Traoré",
    email: `${id}@example.com`,
    phone: null,
    source: "contact_form",
    createdAt: overrides.createdAt ?? new Date("2026-07-20T00:00:00.000Z"),
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
