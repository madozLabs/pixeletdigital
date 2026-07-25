import type { LeadActivity } from "../../domain/lead-activity";
import type { Lead } from "../../domain/lead";
import type { LeadNote } from "../../domain/lead-note";
import type { NextAction } from "../../domain/next-action";
import type { LeadRepository } from "../lead-repository";

export class InMemoryLeadRepository implements LeadRepository {
  readonly savedLeads: Lead[] = [];
  private readonly leadsById = new Map<string, Lead>();
  private readonly enquiryLinks = new Map<string, string>();
  private readonly notesByLead = new Map<string, LeadNote[]>();
  private readonly nextActionsById = new Map<string, NextAction>();
  private readonly activitiesByLead = new Map<string, LeadActivity[]>();

  constructor(leads: readonly Lead[] = []) {
    for (const lead of leads) this.leadsById.set(lead.id, lead);
  }

  async findById(id: string): Promise<Lead | null> {
    return this.leadsById.get(id) ?? null;
  }

  async findByEnquiryId(enquiryId: string): Promise<Lead | null> {
    const leadId = this.enquiryLinks.get(enquiryId);
    return leadId ? (this.leadsById.get(leadId) ?? null) : null;
  }

  async findManyByEnquiryIds(
    enquiryIds: readonly string[],
  ): Promise<ReadonlyMap<string, Lead>> {
    const result = new Map<string, Lead>();
    for (const enquiryId of enquiryIds) {
      const leadId = this.enquiryLinks.get(enquiryId);
      const lead = leadId ? this.leadsById.get(leadId) : undefined;
      if (lead) result.set(enquiryId, lead);
    }
    return result;
  }

  async listByWorld(worldKey: string): Promise<readonly Lead[]> {
    return [...this.leadsById.values()]
      .filter((lead) => lead.worldKey === worldKey)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async save(lead: Lead): Promise<void> {
    this.savedLeads.push(lead);
    this.leadsById.set(lead.id, lead);
  }

  async linkEnquiry(leadId: string, enquiryId: string): Promise<void> {
    this.enquiryLinks.set(enquiryId, leadId);
  }

  async addNote(note: LeadNote): Promise<void> {
    const existing = this.notesByLead.get(note.leadId) ?? [];
    existing.push(note);
    this.notesByLead.set(note.leadId, existing);
  }

  async listNotes(leadId: string): Promise<readonly LeadNote[]> {
    return this.notesByLead.get(leadId) ?? [];
  }

  async addNextAction(nextAction: NextAction): Promise<void> {
    this.nextActionsById.set(nextAction.id, nextAction);
  }

  async updateNextAction(nextAction: NextAction): Promise<void> {
    this.nextActionsById.set(nextAction.id, nextAction);
  }

  async findNextActionById(id: string): Promise<NextAction | null> {
    return this.nextActionsById.get(id) ?? null;
  }

  async listNextActions(leadId: string): Promise<readonly NextAction[]> {
    return [...this.nextActionsById.values()].filter(
      (nextAction) => nextAction.leadId === leadId,
    );
  }

  async recordActivity(activity: LeadActivity): Promise<void> {
    const existing = this.activitiesByLead.get(activity.leadId) ?? [];
    existing.push(activity);
    this.activitiesByLead.set(activity.leadId, existing);
  }

  async listActivities(leadId: string): Promise<readonly LeadActivity[]> {
    return this.activitiesByLead.get(leadId) ?? [];
  }
}
