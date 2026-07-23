export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export const CLIENT_STATUSES = ["ACTIVE", "ARCHIVED"] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export type ClientDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_WORLD_KEY"
  | "INVALID_NAME"
  | "INVALID_EMAIL"
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
  email: string | null;
  phone: string | null;
  address: string | null;
  status: ClientStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export function isClientStatus(value: string): value is ClientStatus {
  return CLIENT_STATUSES.includes(value as ClientStatus);
}

export function createClient(
  input: Readonly<{
    id: string;
    worldKey: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
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

  const nameResult = parseName(input.name);
  if (!nameResult.ok) return nameResult;

  const emailResult = parseEmail(input.email);
  if (!emailResult.ok) return emailResult;

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey: worldKeyResult.value,
      name: nameResult.value,
      email: emailResult.value,
      phone: input.phone?.trim() ? input.phone.trim() : null,
      address: input.address?.trim() ? input.address.trim() : null,
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
    email: string | null;
    phone: string | null;
    address: string | null;
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

  const nameResult = parseName(input.name);
  if (!nameResult.ok) return nameResult;

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
      name: nameResult.value,
      email: input.email,
      phone: input.phone,
      address: input.address,
      status: input.status,
      version: input.version,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function editClient(
  client: Client,
  changes: Readonly<{
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  }>,
  updatedAt: Date,
): Result<Client, ClientDomainError> {
  const nameResult = parseName(changes.name);
  if (!nameResult.ok) return nameResult;

  const emailResult = parseEmail(changes.email);
  if (!emailResult.ok) return emailResult;

  return {
    ok: true,
    value: Object.freeze({
      ...client,
      name: nameResult.value,
      email: emailResult.value,
      phone: changes.phone?.trim() ? changes.phone.trim() : null,
      address: changes.address?.trim() ? changes.address.trim() : null,
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

function failure(
  code: ClientDomainErrorCode,
  message: string,
): Result<never, ClientDomainError> {
  return { ok: false, error: { code, message } };
}
