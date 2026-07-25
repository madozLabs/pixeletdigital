import type { LeadActivity } from "../domain/lead-activity";
import type { Lead } from "../domain/lead";
import type { LeadNote } from "../domain/lead-note";
import type { NextAction } from "../domain/next-action";

export interface LeadRepository {
  findById(id: string): Promise<Lead | null>;
  findByEnquiryId(enquiryId: string): Promise<Lead | null>;
  findManyByEnquiryIds(
    enquiryIds: readonly string[],
  ): Promise<ReadonlyMap<string, Lead>>;
  listByWorld(worldKey: string): Promise<readonly Lead[]>;
  save(lead: Lead): Promise<void>;
  linkEnquiry(
    leadId: string,
    enquiryId: string,
    createdAt: Date,
  ): Promise<void>;

  addNote(note: LeadNote): Promise<void>;
  listNotes(leadId: string): Promise<readonly LeadNote[]>;

  addNextAction(nextAction: NextAction): Promise<void>;
  updateNextAction(nextAction: NextAction): Promise<void>;
  findNextActionById(id: string): Promise<NextAction | null>;
  listNextActions(leadId: string): Promise<readonly NextAction[]>;

  recordActivity(activity: LeadActivity): Promise<void>;
  listActivities(leadId: string): Promise<readonly LeadActivity[]>;
}
