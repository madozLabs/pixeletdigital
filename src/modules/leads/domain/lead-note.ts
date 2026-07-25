import type { Result } from "./lead";

export type LeadNoteDomainErrorCode =
  "INVALID_ID" | "INVALID_LEAD_ID" | "INVALID_AUTHOR_ID" | "INVALID_BODY";

export type LeadNoteDomainError = Readonly<{
  code: LeadNoteDomainErrorCode;
  message: string;
}>;

export type LeadNote = Readonly<{
  id: string;
  leadId: string;
  authorId: string;
  body: string;
  createdAt: Date;
}>;

export function createLeadNote(
  input: Readonly<{
    id: string;
    leadId: string;
    authorId: string;
    body: string;
    createdAt: Date;
  }>,
): Result<LeadNote, LeadNoteDomainError> {
  const id = input.id.trim();
  if (!id) {
    return failure(
      "INVALID_ID",
      "Lead note id must be a non-empty opaque identifier.",
    );
  }

  const leadId = input.leadId.trim();
  if (!leadId) {
    return failure(
      "INVALID_LEAD_ID",
      "Lead note leadId must be a non-empty identifier.",
    );
  }

  const authorId = input.authorId.trim();
  if (!authorId) {
    return failure(
      "INVALID_AUTHOR_ID",
      "Lead note authorId must be a non-empty identifier.",
    );
  }

  const body = input.body.trim();
  if (!body || body.length > 2000) {
    return failure(
      "INVALID_BODY",
      "Lead note body must contain between 1 and 2000 characters.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      leadId,
      authorId,
      body,
      createdAt: new Date(input.createdAt),
    }),
  };
}

function failure(
  code: LeadNoteDomainErrorCode,
  message: string,
): Result<never, LeadNoteDomainError> {
  return { ok: false, error: { code, message } };
}
