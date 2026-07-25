import type {
  Lead as PrismaLead,
  LeadActivity as PrismaLeadActivity,
  LeadNote as PrismaLeadNote,
  NextAction as PrismaNextAction,
  PrismaClient,
} from "@/generated/prisma/client";

import { restoreLead, type Lead } from "../domain/lead";
import type { LeadActivity } from "../domain/lead-activity";
import type { LeadNote } from "../domain/lead-note";
import type { NextAction } from "../domain/next-action";
import type { LeadRepository } from "../application/lead-repository";

export class PrismaLeadRepository implements LeadRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(id: string): Promise<Lead | null> {
    const record = await this.client.lead.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async findByEnquiryId(enquiryId: string): Promise<Lead | null> {
    const link = await this.client.leadEnquiry.findUnique({
      where: { enquiryId },
      include: { lead: true },
    });
    return link ? toDomain(link.lead) : null;
  }

  async findManyByEnquiryIds(
    enquiryIds: readonly string[],
  ): Promise<ReadonlyMap<string, Lead>> {
    if (enquiryIds.length === 0) return new Map();
    const links = await this.client.leadEnquiry.findMany({
      where: { enquiryId: { in: [...enquiryIds] } },
      include: { lead: true },
    });
    return new Map(links.map((link) => [link.enquiryId, toDomain(link.lead)]));
  }

  async listByWorld(worldKey: string): Promise<readonly Lead[]> {
    const records = await this.client.lead.findMany({
      where: { worldKey },
      orderBy: { createdAt: "desc" },
    });
    return records.map(toDomain);
  }

  // Deliberately not wrapped in an interactive $transaction(async (tx) => {});
  // see PrismaEnquiryRepository.save for why that pattern is avoided in this
  // codebase (Prisma 7 + the PGlite driver adapter corrupts bound parameters
  // on the second create after repeated interactive transactions).
  async save(lead: Lead): Promise<void> {
    const existing = await this.client.lead.findUnique({
      where: { id: lead.id },
      select: { id: true },
    });

    if (!existing) {
      await this.client.lead.create({
        data: {
          id: lead.id,
          worldKey: lead.worldKey,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          source: lead.source,
          status: lead.status,
          ownerUserId: lead.ownerUserId,
          closedOutcome: lead.closedOutcome,
          version: lead.version,
          createdAt: lead.createdAt,
          updatedAt: lead.updatedAt,
        },
      });
      return;
    }

    await this.client.lead.update({
      where: { id: lead.id },
      data: {
        status: lead.status,
        ownerUserId: lead.ownerUserId,
        closedOutcome: lead.closedOutcome,
        version: lead.version,
        updatedAt: lead.updatedAt,
      },
    });
  }

  async linkEnquiry(
    leadId: string,
    enquiryId: string,
    createdAt: Date,
  ): Promise<void> {
    await this.client.leadEnquiry.create({
      data: {
        id: `lead_enquiry_${leadId}`,
        leadId,
        enquiryId,
        createdAt,
      },
    });
  }

  async addNote(note: LeadNote): Promise<void> {
    await this.client.leadNote.create({
      data: {
        id: note.id,
        leadId: note.leadId,
        authorId: note.authorId,
        body: note.body,
        createdAt: note.createdAt,
      },
    });
  }

  async listNotes(leadId: string): Promise<readonly LeadNote[]> {
    const records = await this.client.leadNote.findMany({
      where: { leadId },
      orderBy: { createdAt: "desc" },
    });
    return records.map(toNoteDomain);
  }

  async addNextAction(nextAction: NextAction): Promise<void> {
    await this.client.nextAction.create({
      data: {
        id: nextAction.id,
        leadId: nextAction.leadId,
        ownerUserId: nextAction.ownerUserId,
        description: nextAction.description,
        dueDate: nextAction.dueDate,
        status: nextAction.status,
        completedAt: nextAction.completedAt,
        createdAt: nextAction.createdAt,
      },
    });
  }

  async updateNextAction(nextAction: NextAction): Promise<void> {
    await this.client.nextAction.update({
      where: { id: nextAction.id },
      data: {
        status: nextAction.status,
        completedAt: nextAction.completedAt,
      },
    });
  }

  async findNextActionById(id: string): Promise<NextAction | null> {
    const record = await this.client.nextAction.findUnique({ where: { id } });
    return record ? toNextActionDomain(record) : null;
  }

  async listNextActions(leadId: string): Promise<readonly NextAction[]> {
    const records = await this.client.nextAction.findMany({
      where: { leadId },
      orderBy: { dueDate: "asc" },
    });
    return records.map(toNextActionDomain);
  }

  async recordActivity(activity: LeadActivity): Promise<void> {
    await this.client.leadActivity.create({
      data: {
        id: activity.id,
        leadId: activity.leadId,
        type: activity.type,
        actorId: activity.actorId,
        detail: activity.detail,
        occurredAt: activity.occurredAt,
      },
    });
  }

  async listActivities(leadId: string): Promise<readonly LeadActivity[]> {
    const records = await this.client.leadActivity.findMany({
      where: { leadId },
      orderBy: { occurredAt: "desc" },
    });
    return records.map(toActivityDomain);
  }
}

function toDomain(record: PrismaLead): Lead {
  const result = restoreLead(record);
  if (!result.ok) {
    throw new Error(`Persisted Lead is invalid: ${result.error.code}`);
  }
  return result.value;
}

function toNoteDomain(record: PrismaLeadNote): LeadNote {
  return {
    id: record.id,
    leadId: record.leadId,
    authorId: record.authorId,
    body: record.body,
    createdAt: record.createdAt,
  };
}

function toNextActionDomain(record: PrismaNextAction): NextAction {
  return {
    id: record.id,
    leadId: record.leadId,
    ownerUserId: record.ownerUserId,
    description: record.description,
    dueDate: record.dueDate,
    status: record.status,
    completedAt: record.completedAt,
    createdAt: record.createdAt,
  };
}

function toActivityDomain(record: PrismaLeadActivity): LeadActivity {
  return {
    id: record.id,
    leadId: record.leadId,
    type: record.type,
    actorId: record.actorId,
    detail: record.detail,
    occurredAt: record.occurredAt,
  };
}
