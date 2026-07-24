export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export const CLIENT_STATUSES = ["ACTIVE", "ARCHIVED"] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export type ClientDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_WORLD_KEY"
  | "INVALID_NAME"
  | "INVALID_EMAIL"
  | "INVALID_LEGAL_NAME"
  | "INVALID_INDUSTRY"
  | "INVALID_WEBSITE"
  | "INVALID_LOGO_URL"
  | "INVALID_NOTES"
  | "INVALID_STATUS"
  | "INVALID_VERSION"
  | "INVALID_TRANSITION";

export type ClientDomainError = Readonly<{
  code: ClientDomainErrorCode;
  message: string;
}>;

export type Client = Readonly<{
  id: string;
  worldKey: string;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  logoUrl: string | null;
  industry: string | null;
  notes: string | null;
  accountManagerId: string | null;
  commercialOwnerId: string | null;
  teamId: string | null;
  status: ClientStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export type ClientFields = Readonly<{
  name: string;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  industry?: string | null;
  notes?: string | null;
  accountManagerId?: string | null;
  commercialOwnerId?: string | null;
  teamId?: string | null;
}>;

export function isClientStatus(value: string): value is ClientStatus {
  return CLIENT_STATUSES.includes(value as ClientStatus);
}

export function createClient(
  input: ClientFields & {
    id: string;
    worldKey: string;
    createdAt: Date;
    updatedAt: Date;
  },
): Result<Client, ClientDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "Client id must be a non-empty opaque identifier.",
    );
  }

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return worldKeyResult;

  const fieldsResult = parseFields(input);
  if (!fieldsResult.ok) return fieldsResult;

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey: worldKeyResult.value,
      ...fieldsResult.value,
      accountManagerId: input.accountManagerId?.trim() || null,
      commercialOwnerId: input.commercialOwnerId?.trim() || null,
      teamId: input.teamId?.trim() || null,
      status: "ACTIVE",
      version: 1,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function restoreClient(
  input: Readonly<{
    id: string;
    worldKey: string;
    name: string;
    legalName: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    website: string | null;
    logoUrl: string | null;
    industry: string | null;
    notes: string | null;
    accountManagerId: string | null;
    commercialOwnerId: string | null;
    teamId: string | null;
    status: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }>,
): Result<Client, ClientDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "Client id must be a non-empty opaque identifier.",
    );
  }

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return worldKeyResult;

  const fieldsResult = parseFields(input);
  if (!fieldsResult.ok) return fieldsResult;

  if (!isClientStatus(input.status)) {
    return failure(
      "INVALID_STATUS",
      "Client status is not part of the controlled vocabulary.",
    );
  }

  if (!Number.isInteger(input.version) || input.version < 1) {
    return failure(
      "INVALID_VERSION",
      "Client version must be a positive integer.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey: worldKeyResult.value,
      ...fieldsResult.value,
      accountManagerId: input.accountManagerId,
      commercialOwnerId: input.commercialOwnerId,
      teamId: input.teamId,
      status: input.status,
      version: input.version,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function editClient(
  client: Client,
  changes: ClientFields,
  updatedAt: Date,
): Result<Client, ClientDomainError> {
  const fieldsResult = parseFields(changes);
  if (!fieldsResult.ok) return fieldsResult;

  return {
    ok: true,
    value: Object.freeze({
      ...client,
      ...fieldsResult.value,
      accountManagerId: changes.accountManagerId?.trim() || null,
      commercialOwnerId: changes.commercialOwnerId?.trim() || null,
      teamId: changes.teamId?.trim() || null,
      version: client.version + 1,
      updatedAt: new Date(updatedAt),
    }),
  };
}

export function archiveClient(
  client: Client,
  updatedAt: Date,
): Result<Client, ClientDomainError> {
  if (client.status === "ARCHIVED") {
    return failure("INVALID_TRANSITION", "Client is already archived.");
  }

  return {
    ok: true,
    value: Object.freeze({
      ...client,
      status: "ARCHIVED",
      version: client.version + 1,
      updatedAt: new Date(updatedAt),
    }),
  };
}

type ParsedFields = Readonly<{
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  logoUrl: string | null;
  industry: string | null;
  notes: string | null;
}>;

function parseFields(
  input: ClientFields,
): Result<ParsedFields, ClientDomainError> {
  const nameResult = parseName(input.name);
  if (!nameResult.ok) return nameResult;

  const emailResult = parseEmail(input.email);
  if (!emailResult.ok) return emailResult;

  const legalNameResult = parseOptional(
    input.legalName,
    180,
    "INVALID_LEGAL_NAME",
    "legalName",
  );
  if (!legalNameResult.ok) return legalNameResult;

  const industryResult = parseOptional(
    input.industry,
    120,
    "INVALID_INDUSTRY",
    "industry",
  );
  if (!industryResult.ok) return industryResult;

  const websiteResult = parseOptional(
    input.website,
    240,
    "INVALID_WEBSITE",
    "website",
  );
  if (!websiteResult.ok) return websiteResult;

  const logoUrlResult = parseOptional(
    input.logoUrl,
    500,
    "INVALID_LOGO_URL",
    "logoUrl",
  );
  if (!logoUrlResult.ok) return logoUrlResult;

  const notesResult = parseOptional(
    input.notes,
    1200,
    "INVALID_NOTES",
    "notes",
  );
  if (!notesResult.ok) return notesResult;

  return {
    ok: true,
    value: {
      name: nameResult.value,
      email: emailResult.value,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      legalName: legalNameResult.value,
      industry: industryResult.value,
      website: websiteResult.value,
      logoUrl: logoUrlResult.value,
      notes: notesResult.value,
    },
  };
}

function parseWorldKey(rawWorldKey: string): Result<string, ClientDomainError> {
  const worldKey = rawWorldKey.trim();
  if (!worldKey || worldKey.length > 64) {
    return failure(
      "INVALID_WORLD_KEY",
      "Client worldKey must be a non-empty world stable key.",
    );
  }
  return { ok: true, value: worldKey };
}

function parseName(rawName: string): Result<string, ClientDomainError> {
  const name = rawName.trim();
  if (!name || name.length > 160) {
    return failure(
      "INVALID_NAME",
      "Client name must contain between 1 and 160 characters.",
    );
  }
  return { ok: true, value: name };
}

function parseEmail(
  rawEmail: string | null | undefined,
): Result<string | null, ClientDomainError> {
  if (!rawEmail || !rawEmail.trim()) return { ok: true, value: null };
  const email = rawEmail.trim();
  if (!email.includes("@") || email.length > 254) {
    return failure(
      "INVALID_EMAIL",
      "Client email must be a valid email address.",
    );
  }
  return { ok: true, value: email };
}

function parseOptional(
  rawValue: string | null | undefined,
  maxLength: number,
  code: ClientDomainErrorCode,
  fieldName: string,
): Result<string | null, ClientDomainError> {
  if (!rawValue || !rawValue.trim()) return { ok: true, value: null };
  const value = rawValue.trim();
  if (value.length > maxLength) {
    return failure(
      code,
      `Client ${fieldName} must contain at most ${maxLength} characters.`,
    );
  }
  return { ok: true, value };
}

function failure(
  code: ClientDomainErrorCode,
  message: string,
): Result<never, ClientDomainError> {
  return { ok: false, error: { code, message } };
}
