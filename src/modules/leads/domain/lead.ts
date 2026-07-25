export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export const LEAD_STATUSES = [
  "NEW",
  "IN_REVIEW",
  "QUALIFIED",
  "UNQUALIFIED",
  "CLOSED",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type LeadDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_WORLD_KEY"
  | "INVALID_NAME"
  | "INVALID_EMAIL"
  | "INVALID_PHONE"
  | "INVALID_SOURCE"
  | "INVALID_OWNER_USER_ID"
  | "INVALID_CLOSED_OUTCOME"
  | "INVALID_STATUS"
  | "INVALID_VERSION"
  | "INVALID_TRANSITION";

export type LeadDomainError = Readonly<{
  code: LeadDomainErrorCode;
  message: string;
}>;

export type Lead = Readonly<{
  id: string;
  worldKey: string;
  name: string;
  email: string;
  phone: string | null;
  source: string;
  status: LeadStatus;
  ownerUserId: string | null;
  closedOutcome: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A lead may only move forward through qualification, and closing requires
// having passed through a qualification decision first (DATA_MODEL.md §5).
const ALLOWED_TRANSITIONS: Readonly<Record<LeadStatus, readonly LeadStatus[]>> =
  {
    NEW: ["IN_REVIEW"],
    IN_REVIEW: ["QUALIFIED", "UNQUALIFIED"],
    QUALIFIED: ["CLOSED"],
    UNQUALIFIED: ["CLOSED"],
    CLOSED: [],
  };

export function isLeadStatus(value: string): value is LeadStatus {
  return LEAD_STATUSES.includes(value as LeadStatus);
}

export type CreateLeadInput = Readonly<{
  id: string;
  worldKey: string;
  name: string;
  email: string;
  phone?: string | null;
  source: string;
  createdAt: Date;
}>;

export function createLead(
  input: CreateLeadInput,
): Result<Lead, LeadDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "Lead id must be a non-empty opaque identifier.",
    );
  }

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return worldKeyResult;

  const nameResult = parseName(input.name);
  if (!nameResult.ok) return nameResult;

  const emailResult = parseEmail(input.email);
  if (!emailResult.ok) return emailResult;

  const phoneResult = parsePhone(input.phone ?? null);
  if (!phoneResult.ok) return phoneResult;

  const sourceResult = parseSource(input.source);
  if (!sourceResult.ok) return sourceResult;

  const createdAt = new Date(input.createdAt);
  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey: worldKeyResult.value,
      name: nameResult.value,
      email: emailResult.value,
      phone: phoneResult.value,
      source: sourceResult.value,
      status: "NEW",
      ownerUserId: null,
      closedOutcome: null,
      version: 1,
      createdAt,
      updatedAt: createdAt,
    }),
  };
}

export function restoreLead(
  input: Readonly<{
    id: string;
    worldKey: string;
    name: string;
    email: string;
    phone: string | null;
    source: string;
    status: string;
    ownerUserId: string | null;
    closedOutcome: string | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }>,
): Result<Lead, LeadDomainError> {
  const id = input.id.trim();
  if (!id) {
    return failure(
      "INVALID_ID",
      "Lead id must be a non-empty opaque identifier.",
    );
  }

  if (!isLeadStatus(input.status)) {
    return failure(
      "INVALID_STATUS",
      "Lead status is not part of the controlled vocabulary.",
    );
  }

  if (!Number.isInteger(input.version) || input.version < 1) {
    return failure(
      "INVALID_VERSION",
      "Lead version must be a positive integer.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey: input.worldKey,
      name: input.name,
      email: input.email,
      phone: input.phone,
      source: input.source,
      status: input.status,
      ownerUserId: input.ownerUserId,
      closedOutcome: input.closedOutcome,
      version: input.version,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function setLeadStatus(
  lead: Lead,
  status: string,
  now: Date,
  closedOutcome?: string | null,
): Result<Lead, LeadDomainError> {
  if (!isLeadStatus(status)) {
    return failure(
      "INVALID_STATUS",
      "Lead status is not part of the controlled vocabulary.",
    );
  }

  const allowed = ALLOWED_TRANSITIONS[lead.status];
  if (!allowed.includes(status)) {
    return failure(
      "INVALID_TRANSITION",
      `Lead cannot move from ${lead.status} to ${status}.`,
    );
  }

  let closedOutcomeValue = lead.closedOutcome;
  if (status === "CLOSED") {
    const outcome = (closedOutcome ?? "").trim();
    if (!outcome || outcome.length > 500) {
      return failure(
        "INVALID_CLOSED_OUTCOME",
        "Closing a lead requires a closedOutcome of 1 to 500 characters.",
      );
    }
    closedOutcomeValue = outcome;
  }

  return {
    ok: true,
    value: Object.freeze({
      ...lead,
      status,
      closedOutcome: closedOutcomeValue,
      version: lead.version + 1,
      updatedAt: new Date(now),
    }),
  };
}

export function assignLeadOwner(
  lead: Lead,
  ownerUserId: string,
  now: Date,
): Result<Lead, LeadDomainError> {
  if (lead.status === "CLOSED") {
    return failure(
      "INVALID_TRANSITION",
      "A closed lead can no longer be reassigned.",
    );
  }

  const trimmed = ownerUserId.trim();
  if (!trimmed) {
    return failure(
      "INVALID_OWNER_USER_ID",
      "Lead ownerUserId must be a non-empty identifier.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      ...lead,
      ownerUserId: trimmed,
      version: lead.version + 1,
      updatedAt: new Date(now),
    }),
  };
}

function parseWorldKey(rawWorldKey: string): Result<string, LeadDomainError> {
  const worldKey = rawWorldKey.trim();
  if (!worldKey || worldKey.length > 64) {
    return failure(
      "INVALID_WORLD_KEY",
      "Lead worldKey must be a non-empty world stable key.",
    );
  }
  return { ok: true, value: worldKey };
}

function parseName(rawName: string): Result<string, LeadDomainError> {
  const name = rawName.trim();
  if (!name || name.length > 160) {
    return failure(
      "INVALID_NAME",
      "Lead name must contain between 1 and 160 characters.",
    );
  }
  return { ok: true, value: name };
}

function parseEmail(rawEmail: string): Result<string, LeadDomainError> {
  const email = rawEmail.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return failure("INVALID_EMAIL", "Lead email must be a valid address.");
  }
  return { ok: true, value: email };
}

function parsePhone(
  rawPhone: string | null,
): Result<string | null, LeadDomainError> {
  if (rawPhone === null) return { ok: true, value: null };
  const phone = rawPhone.trim();
  return { ok: true, value: phone || null };
}

function parseSource(rawSource: string): Result<string, LeadDomainError> {
  const source = rawSource.trim();
  if (!source || source.length > 120) {
    return failure(
      "INVALID_SOURCE",
      "Lead source must contain between 1 and 120 characters.",
    );
  }
  return { ok: true, value: source };
}

function failure(
  code: LeadDomainErrorCode,
  message: string,
): Result<never, LeadDomainError> {
  return { ok: false, error: { code, message } };
}
