import type { Result } from "./lead";

export const NEXT_ACTION_STATUSES = [
  "PENDING",
  "COMPLETED",
  "CANCELLED",
] as const;
export type NextActionStatus = (typeof NEXT_ACTION_STATUSES)[number];

export type NextActionDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_LEAD_ID"
  | "INVALID_OWNER_USER_ID"
  | "INVALID_DESCRIPTION"
  | "INVALID_DUE_DATE"
  | "INVALID_TRANSITION";

export type NextActionDomainError = Readonly<{
  code: NextActionDomainErrorCode;
  message: string;
}>;

export type NextAction = Readonly<{
  id: string;
  leadId: string;
  ownerUserId: string;
  description: string;
  dueDate: Date;
  status: NextActionStatus;
  completedAt: Date | null;
  createdAt: Date;
}>;

export function createNextAction(
  input: Readonly<{
    id: string;
    leadId: string;
    ownerUserId: string;
    description: string;
    dueDate: Date;
    createdAt: Date;
  }>,
): Result<NextAction, NextActionDomainError> {
  const id = input.id.trim();
  if (!id) {
    return failure(
      "INVALID_ID",
      "Next action id must be a non-empty opaque identifier.",
    );
  }

  const leadId = input.leadId.trim();
  if (!leadId) {
    return failure(
      "INVALID_LEAD_ID",
      "Next action leadId must be a non-empty identifier.",
    );
  }

  const ownerUserId = input.ownerUserId.trim();
  if (!ownerUserId) {
    return failure(
      "INVALID_OWNER_USER_ID",
      "Next action ownerUserId must be a non-empty identifier.",
    );
  }

  const description = input.description.trim();
  if (!description || description.length > 500) {
    return failure(
      "INVALID_DESCRIPTION",
      "Next action description must contain between 1 and 500 characters.",
    );
  }

  const dueDate = new Date(input.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    return failure(
      "INVALID_DUE_DATE",
      "Next action dueDate must be a valid date.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      leadId,
      ownerUserId,
      description,
      dueDate,
      status: "PENDING",
      completedAt: null,
      createdAt: new Date(input.createdAt),
    }),
  };
}

export function completeNextAction(
  nextAction: NextAction,
  now: Date,
): Result<NextAction, NextActionDomainError> {
  if (nextAction.status !== "PENDING") {
    return failure(
      "INVALID_TRANSITION",
      `Only a pending next action can be completed, but status is ${nextAction.status}.`,
    );
  }
  return {
    ok: true,
    value: Object.freeze({
      ...nextAction,
      status: "COMPLETED",
      completedAt: new Date(now),
    }),
  };
}

export function cancelNextAction(
  nextAction: NextAction,
): Result<NextAction, NextActionDomainError> {
  if (nextAction.status !== "PENDING") {
    return failure(
      "INVALID_TRANSITION",
      `Only a pending next action can be cancelled, but status is ${nextAction.status}.`,
    );
  }
  return {
    ok: true,
    value: Object.freeze({ ...nextAction, status: "CANCELLED" }),
  };
}

function failure(
  code: NextActionDomainErrorCode,
  message: string,
): Result<never, NextActionDomainError> {
  return { ok: false, error: { code, message } };
}
