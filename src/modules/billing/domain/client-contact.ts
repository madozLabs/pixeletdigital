export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export type ClientContactDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_CLIENT_ID"
  | "INVALID_NAME"
  | "INVALID_ROLE"
  | "INVALID_EMAIL";

export type ClientContactDomainError = Readonly<{
  code: ClientContactDomainErrorCode;
  message: string;
}>;

export type ClientContact = Readonly<{
  id: string;
  clientId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}>;

export function createClientContact(
  input: Readonly<{
    id: string;
    clientId: string;
    name: string;
    role?: string | null;
    email?: string | null;
    phone?: string | null;
    isPrimary: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>,
): Result<ClientContact, ClientContactDomainError> {
  const id = input.id.trim();
  if (!id) {
    return failure(
      "INVALID_ID",
      "ClientContact id must be a non-empty opaque identifier.",
    );
  }

  const clientId = input.clientId.trim();
  if (!clientId) {
    return failure(
      "INVALID_CLIENT_ID",
      "ClientContact clientId must be a non-empty identifier.",
    );
  }

  const name = input.name.trim();
  if (!name || name.length > 160) {
    return failure(
      "INVALID_NAME",
      "ClientContact name must contain between 1 and 160 characters.",
    );
  }

  if (input.role && input.role.trim().length > 120) {
    return failure(
      "INVALID_ROLE",
      "ClientContact role must contain at most 120 characters.",
    );
  }

  if (input.email && input.email.trim() && !input.email.includes("@")) {
    return failure(
      "INVALID_EMAIL",
      "ClientContact email must be a valid email address.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      clientId,
      name,
      role: input.role?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      isPrimary: input.isPrimary,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function restoreClientContact(
  input: Readonly<{
    id: string;
    clientId: string;
    name: string;
    role: string | null;
    email: string | null;
    phone: string | null;
    isPrimary: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>,
): Result<ClientContact, ClientContactDomainError> {
  return createClientContact(input);
}

function failure(
  code: ClientContactDomainErrorCode,
  message: string,
): Result<never, ClientContactDomainError> {
  return { ok: false, error: { code, message } };
}
