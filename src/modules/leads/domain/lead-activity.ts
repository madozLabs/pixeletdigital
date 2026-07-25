import type { Result } from "./lead";

export const LEAD_ACTIVITY_TYPES = [
  "CREATED",
  "STATUS_CHANGED",
  "ASSIGNED",
  "NOTE_ADDED",
  "NEXT_ACTION_SET",
  "NEXT_ACTION_COMPLETED",
] as const;
export type LeadActivityType = (typeof LEAD_ACTIVITY_TYPES)[number];

export type LeadActivityDomainErrorCode =
  "INVALID_ID" | "INVALID_LEAD_ID" | "INVALID_TYPE";

export type LeadActivityDomainError = Readonly<{
  code: LeadActivityDomainErrorCode;
  message: string;
}>;

export type LeadActivity = Readonly<{
  id: string;
  leadId: string;
  type: LeadActivityType;
  actorId: string | null;
  detail: string | null;
  occurredAt: Date;
}>;

export function isLeadActivityType(value: string): value is LeadActivityType {
  return LEAD_ACTIVITY_TYPES.includes(value as LeadActivityType);
}

export function createLeadActivity(
  input: Readonly<{
    id: string;
    leadId: string;
    type: string;
    actorId?: string | null;
    detail?: string | null;
    occurredAt: Date;
  }>,
): Result<LeadActivity, LeadActivityDomainError> {
  const id = input.id.trim();
  if (!id) {
    return failure(
      "INVALID_ID",
      "Lead activity id must be a non-empty opaque identifier.",
    );
  }

  const leadId = input.leadId.trim();
  if (!leadId) {
    return failure(
      "INVALID_LEAD_ID",
      "Lead activity leadId must be a non-empty identifier.",
    );
  }

  if (!isLeadActivityType(input.type)) {
    return failure(
      "INVALID_TYPE",
      "Lead activity type is not part of the controlled vocabulary.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      leadId,
      type: input.type,
      actorId: input.actorId?.trim() || null,
      detail: input.detail?.trim() || null,
      occurredAt: new Date(input.occurredAt),
    }),
  };
}

function failure(
  code: LeadActivityDomainErrorCode,
  message: string,
): Result<never, LeadActivityDomainError> {
  return { ok: false, error: { code, message } };
}
