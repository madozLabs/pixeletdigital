import { randomUUID } from "node:crypto";

import type { RequestContext } from "@/shared/request-context";

import { createLeadActivity, type LeadActivity } from "../domain/lead-activity";
import {
  assignLeadOwner,
  createLead,
  setLeadStatus,
  type Lead,
  type LeadDomainError,
  type Result,
} from "../domain/lead";
import {
  createLeadNote,
  type LeadNote,
  type LeadNoteDomainError,
} from "../domain/lead-note";
import {
  completeNextAction as completeNextActionDomain,
  createNextAction,
  type NextAction,
  type NextActionDomainError,
} from "../domain/next-action";
import type { LeadApplicationError } from "./application-error";
import {
  forbidden,
  hasWorldScope,
  mayManageLeads,
  requireActiveActor,
} from "./lead-authorization";
import type { LeadRepository } from "./lead-repository";

export type LeadDependencies = Readonly<{ leads: LeadRepository }>;

// Triggered as a side effect of a public enquiry submission (unauthenticated
// by design, same shape as submitGeneralContact) rather than a workspace
// action -- see DOMAIN_BOUNDARIES.md §2 "A submission may create or
// associate a lead through an explicit Leads use case".
export type CreateLeadFromEnquiryInput = Readonly<{
  enquiryId: string;
  worldKey: string;
  name: string;
  email: string;
  phone?: string | null;
  source: string;
  now: Date;
}>;

export async function createLeadFromEnquiry(
  dependencies: LeadDependencies,
  input: CreateLeadFromEnquiryInput,
): Promise<Result<Lead, LeadApplicationError>> {
  const existing = await dependencies.leads.findByEnquiryId(input.enquiryId);
  if (existing) return { ok: true, value: existing };

  const leadResult = createLead({
    id: `lead_${randomUUID()}`,
    worldKey: input.worldKey,
    name: input.name,
    email: input.email,
    phone: input.phone,
    source: input.source,
    createdAt: input.now,
  });
  if (!leadResult.ok) return validationFailure(leadResult.error);

  await dependencies.leads.save(leadResult.value);
  await dependencies.leads.linkEnquiry(
    leadResult.value.id,
    input.enquiryId,
    input.now,
  );
  await recordActivity(
    dependencies,
    leadResult.value.id,
    "CREATED",
    null,
    input.now,
  );

  return { ok: true, value: leadResult.value };
}

export type ListLeadsByWorldInput = Readonly<{ worldKey: string }>;

export async function listLeadsByWorld(
  dependencies: LeadDependencies,
  context: RequestContext,
  input: ListLeadsByWorldInput,
): Promise<Result<readonly Lead[], LeadApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

  if (
    !mayManageLeads(actorResult.value) ||
    !hasWorldScope(actorResult.value, input.worldKey)
  ) {
    return forbidden();
  }

  const leads = await dependencies.leads.listByWorld(input.worldKey);
  return { ok: true, value: leads };
}

export type ListLeadsForEnquiriesInput = Readonly<{
  worldKey: string;
  enquiryIds: readonly string[];
}>;

export async function listLeadsForEnquiries(
  dependencies: LeadDependencies,
  context: RequestContext,
  input: ListLeadsForEnquiriesInput,
): Promise<Result<ReadonlyMap<string, Lead>, LeadApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

  if (
    !mayManageLeads(actorResult.value) ||
    !hasWorldScope(actorResult.value, input.worldKey)
  ) {
    return forbidden();
  }

  const leadsByEnquiryId = await dependencies.leads.findManyByEnquiryIds(
    input.enquiryIds,
  );
  return { ok: true, value: leadsByEnquiryId };
}

export type GetLeadByIdInput = Readonly<{ id: string }>;

export async function getLeadById(
  dependencies: LeadDependencies,
  context: RequestContext,
  input: GetLeadByIdInput,
): Promise<Result<Lead, LeadApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

  const lead = await dependencies.leads.findById(input.id);
  if (!lead) return notFound();
  if (
    !mayManageLeads(actorResult.value) ||
    !hasWorldScope(actorResult.value, lead.worldKey)
  ) {
    return forbidden();
  }

  return { ok: true, value: lead };
}

export type GetLeadDetailInput = Readonly<{ id: string }>;

export type LeadDetail = Readonly<{
  lead: Lead;
  notes: readonly LeadNote[];
  nextActions: readonly NextAction[];
  activities: readonly LeadActivity[];
}>;

export async function getLeadDetail(
  dependencies: LeadDependencies,
  context: RequestContext,
  input: GetLeadDetailInput,
): Promise<Result<LeadDetail, LeadApplicationError>> {
  const leadResult = await getLeadById(dependencies, context, input);
  if (!leadResult.ok) return leadResult;

  const [notes, nextActions, activities] = await Promise.all([
    dependencies.leads.listNotes(input.id),
    dependencies.leads.listNextActions(input.id),
    dependencies.leads.listActivities(input.id),
  ]);

  return {
    ok: true,
    value: { lead: leadResult.value, notes, nextActions, activities },
  };
}

export type UpdateLeadStatusInput = Readonly<{
  id: string;
  expectedVersion: number;
  status: string;
  closedOutcome?: string | null;
}>;

export async function updateLeadStatus(
  dependencies: LeadDependencies,
  context: RequestContext,
  input: UpdateLeadStatusInput,
): Promise<Result<Lead, LeadApplicationError>> {
  const result = await withMutableLead(
    dependencies,
    context,
    input,
    (lead, now) => setLeadStatus(lead, input.status, now, input.closedOutcome),
  );
  if (result.ok) {
    await recordActivity(
      dependencies,
      result.value.id,
      "STATUS_CHANGED",
      `New status: ${result.value.status}`,
      result.value.updatedAt,
      context.actor?.id ?? null,
    );
  }
  return result;
}

export type AssignLeadInput = Readonly<{
  id: string;
  expectedVersion: number;
  ownerUserId: string;
}>;

export async function assignLead(
  dependencies: LeadDependencies,
  context: RequestContext,
  input: AssignLeadInput,
): Promise<Result<Lead, LeadApplicationError>> {
  const result = await withMutableLead(
    dependencies,
    context,
    input,
    (lead, now) => assignLeadOwner(lead, input.ownerUserId, now),
  );
  if (result.ok) {
    await recordActivity(
      dependencies,
      result.value.id,
      "ASSIGNED",
      input.ownerUserId,
      result.value.updatedAt,
      context.actor?.id ?? null,
    );
  }
  return result;
}

export type AddLeadNoteInput = Readonly<{ leadId: string; body: string }>;

export async function addLeadNote(
  dependencies: LeadDependencies,
  context: RequestContext,
  input: AddLeadNoteInput,
): Promise<Result<LeadNote, LeadApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const lead = await dependencies.leads.findById(input.leadId);
  if (!lead) return notFound();
  if (!mayManageLeads(actor) || !hasWorldScope(actor, lead.worldKey)) {
    return forbidden();
  }

  const now = context.clock.now();
  const noteResult = createLeadNote({
    id: `lead_note_${randomUUID()}`,
    leadId: input.leadId,
    authorId: actor.id,
    body: input.body,
    createdAt: now,
  });
  if (!noteResult.ok) return validationFailure(noteResult.error);

  await dependencies.leads.addNote(noteResult.value);
  await recordActivity(
    dependencies,
    lead.id,
    "NOTE_ADDED",
    null,
    now,
    actor.id,
  );
  return { ok: true, value: noteResult.value };
}

export type SetNextActionInput = Readonly<{
  leadId: string;
  ownerUserId: string;
  description: string;
  dueDate: Date;
}>;

export async function setNextAction(
  dependencies: LeadDependencies,
  context: RequestContext,
  input: SetNextActionInput,
): Promise<Result<NextAction, LeadApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const lead = await dependencies.leads.findById(input.leadId);
  if (!lead) return notFound();
  if (!mayManageLeads(actor) || !hasWorldScope(actor, lead.worldKey)) {
    return forbidden();
  }

  const now = context.clock.now();
  const nextActionResult = createNextAction({
    id: `next_action_${randomUUID()}`,
    leadId: input.leadId,
    ownerUserId: input.ownerUserId,
    description: input.description,
    dueDate: input.dueDate,
    createdAt: now,
  });
  if (!nextActionResult.ok) return validationFailure(nextActionResult.error);

  await dependencies.leads.addNextAction(nextActionResult.value);
  await recordActivity(
    dependencies,
    lead.id,
    "NEXT_ACTION_SET",
    input.description,
    now,
    actor.id,
  );
  return { ok: true, value: nextActionResult.value };
}

export type CompleteNextActionInput = Readonly<{
  leadId: string;
  nextActionId: string;
}>;

export async function completeNextAction(
  dependencies: LeadDependencies,
  context: RequestContext,
  input: CompleteNextActionInput,
): Promise<Result<NextAction, LeadApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const lead = await dependencies.leads.findById(input.leadId);
  if (!lead) return notFound();
  if (!mayManageLeads(actor) || !hasWorldScope(actor, lead.worldKey)) {
    return forbidden();
  }

  const nextAction = await dependencies.leads.findNextActionById(
    input.nextActionId,
  );
  if (!nextAction || nextAction.leadId !== input.leadId) return notFound();

  const now = context.clock.now();
  const completed = completeNextActionDomain(nextAction, now);
  if (!completed.ok) return validationFailure(completed.error);

  await dependencies.leads.updateNextAction(completed.value);
  await recordActivity(
    dependencies,
    lead.id,
    "NEXT_ACTION_COMPLETED",
    completed.value.description,
    now,
    actor.id,
  );
  return { ok: true, value: completed.value };
}

async function withMutableLead(
  dependencies: LeadDependencies,
  context: RequestContext,
  input: Readonly<{ id: string; expectedVersion: number }>,
  transition: (lead: Lead, now: Date) => Result<Lead, LeadDomainError>,
): Promise<Result<Lead, LeadApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const lead = await dependencies.leads.findById(input.id);
  if (!lead) return notFound();

  if (!mayManageLeads(actor) || !hasWorldScope(actor, lead.worldKey)) {
    return forbidden();
  }

  if (lead.version !== input.expectedVersion) {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "The lead has changed since it was last read.",
      },
    };
  }

  const transitioned = transition(lead, context.clock.now());
  if (!transitioned.ok) return validationFailure(transitioned.error);

  await dependencies.leads.save(transitioned.value);
  return { ok: true, value: transitioned.value };
}

async function recordActivity(
  dependencies: LeadDependencies,
  leadId: string,
  type: string,
  detail: string | null,
  occurredAt: Date,
  actorId: string | null = null,
): Promise<void> {
  const activityResult = createLeadActivity({
    id: `lead_activity_${randomUUID()}`,
    leadId,
    type,
    actorId,
    detail,
    occurredAt,
  });
  // An activity log entry is a secondary record of an already-succeeded
  // mutation; a failure here must never surface as if the lead action
  // itself failed (mirrors PrismaEnquiryRepository.save's reasoning).
  if (!activityResult.ok) return;
  await dependencies.leads.recordActivity(activityResult.value);
}

function notFound(): Result<never, LeadApplicationError> {
  return {
    ok: false,
    error: { code: "NOT_FOUND", message: "Lead was not found." },
  };
}

function validationFailure(
  error: LeadDomainError | LeadNoteDomainError | NextActionDomainError,
): Result<never, LeadApplicationError> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      validationCode: error.code,
      message: error.message,
    },
  };
}
