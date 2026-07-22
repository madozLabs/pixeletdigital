import {
  APPROVED_ROLES,
  type ApprovedRole,
  type AuthorizationScope,
} from "@/shared/request-context";

export const USER_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export type UserStatus = (typeof USER_STATUSES)[number];
export type AccessValidationCode =
  | "INVALID_ID"
  | "INVALID_DISPLAY_NAME"
  | "INVALID_EMAIL"
  | "INVALID_IDENTITY"
  | "INVALID_PASSWORD_HASH"
  | "INVALID_USER_STATUS"
  | "INVALID_ROLE"
  | "INVALID_SCOPE"
  | "INVALID_INTERVAL";
export type AccessValidationError = Readonly<{
  code: AccessValidationCode;
  message: string;
}>;
export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export type User = Readonly<{
  id: string;
  displayName?: string;
  normalizedEmail?: string;
  status: UserStatus;
}>;

export const CREDENTIALS_PROVIDER = "credentials";

export type AuthenticatedIdentity = Readonly<{
  provider: string;
  providerAccountId: string;
}>;

export type AuthAccount = AuthenticatedIdentity &
  Readonly<{
    id: string;
    userId: string;
    passwordHash?: string;
  }>;

export type RoleAssignment = Readonly<{
  id: string;
  userId: string;
  role: ApprovedRole;
  scope: AuthorizationScope;
  validFrom: Date;
  validUntil?: Date;
}>;

const WORLD_KEY_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function createUser(
  input: Readonly<{
    id: string;
    displayName?: string | null;
    normalizedEmail?: string | null;
    status: string;
  }>,
): Result<User, AccessValidationError> {
  const id = parseId(input.id);
  if (!id)
    return failure(
      "INVALID_ID",
      "User id must be a non-empty opaque identifier.",
    );

  const hasDisplayName =
    input.displayName !== undefined && input.displayName !== null;
  const hasEmail =
    input.normalizedEmail !== undefined && input.normalizedEmail !== null;
  if (hasDisplayName !== hasEmail) {
    return failure(
      "INVALID_EMAIL",
      "Employee display name and email must be supplied together.",
    );
  }

  let displayName: string | undefined;
  let normalizedEmail: string | undefined;
  if (hasDisplayName && hasEmail) {
    displayName = input.displayName!.trim();
    if (!displayName || displayName.length > 255) {
      return failure(
        "INVALID_DISPLAY_NAME",
        "Display name must be a non-empty value of at most 255 characters.",
      );
    }
    normalizedEmail = normalizeEmail(input.normalizedEmail!) ?? undefined;
    if (!normalizedEmail) {
      return failure("INVALID_EMAIL", "Email address is invalid.");
    }
  }

  if (!USER_STATUSES.includes(input.status as UserStatus)) {
    return failure(
      "INVALID_USER_STATUS",
      "User status is not part of the controlled vocabulary.",
    );
  }
  return {
    ok: true,
    value: Object.freeze({
      id,
      ...(displayName ? { displayName } : {}),
      ...(normalizedEmail ? { normalizedEmail } : {}),
      status: input.status as UserStatus,
    }),
  };
}

export function normalizeEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (value.length > 320) return null;
  const separator = value.lastIndexOf("@");
  if (separator <= 0 || separator === value.length - 1) return null;
  if (value.indexOf("@") !== separator) return null;
  return value;
}

export function createAuthAccount(
  input: Readonly<{
    id: string;
    userId: string;
    provider: string;
    providerAccountId: string;
    passwordHash?: string | null;
  }>,
): Result<AuthAccount, AccessValidationError> {
  const id = parseId(input.id);
  const userId = parseId(input.userId);
  const provider = parseIdentityPart(input.provider);
  const providerAccountId = parseIdentityPart(input.providerAccountId);
  if (!id || !userId) {
    return failure(
      "INVALID_ID",
      "Auth account and user ids must be non-empty opaque identifiers.",
    );
  }
  if (!provider || !providerAccountId) {
    return failure(
      "INVALID_IDENTITY",
      "Provider and provider account id must be non-empty identifiers.",
    );
  }

  const hasPasswordHash =
    input.passwordHash !== undefined && input.passwordHash !== null;
  const passwordHash = hasPasswordHash ? input.passwordHash!.trim() : undefined;
  const isCredentialsProvider = provider === CREDENTIALS_PROVIDER;
  if (isCredentialsProvider && (!passwordHash || passwordHash.length > 255)) {
    return failure(
      "INVALID_PASSWORD_HASH",
      "The credentials provider requires a non-empty password hash.",
    );
  }
  if (!isCredentialsProvider && passwordHash) {
    return failure(
      "INVALID_PASSWORD_HASH",
      "Only the credentials provider may carry a password hash.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      userId,
      provider,
      providerAccountId,
      ...(passwordHash ? { passwordHash } : {}),
    }),
  };
}

export function createRoleAssignment(
  input: Readonly<{
    id: string;
    userId: string;
    role: string;
    scope: unknown;
    validFrom: Date;
    validUntil?: Date;
  }>,
): Result<RoleAssignment, AccessValidationError> {
  const id = parseId(input.id);
  const userId = parseId(input.userId);
  if (!id || !userId)
    return failure(
      "INVALID_ID",
      "Assignment and user ids must be non-empty opaque identifiers.",
    );
  if (!APPROVED_ROLES.includes(input.role as ApprovedRole)) {
    return failure(
      "INVALID_ROLE",
      "Role is not part of the approved vocabulary.",
    );
  }
  const scope = parseScope(input.scope);
  if (!scope)
    return failure(
      "INVALID_SCOPE",
      "Scope must be explicitly GLOBAL or a valid WORLD scope.",
    );
  if (
    !isValidDate(input.validFrom) ||
    (input.validUntil !== undefined && !isValidDate(input.validUntil))
  ) {
    return failure(
      "INVALID_INTERVAL",
      "Assignment interval dates must be valid.",
    );
  }
  if (
    input.validUntil !== undefined &&
    input.validUntil.getTime() <= input.validFrom.getTime()
  ) {
    return failure(
      "INVALID_INTERVAL",
      "validUntil must be later than validFrom.",
    );
  }
  return {
    ok: true,
    value: Object.freeze({
      id,
      userId,
      role: input.role as ApprovedRole,
      scope: Object.freeze(scope),
      validFrom: new Date(input.validFrom),
      ...(input.validUntil === undefined
        ? {}
        : { validUntil: new Date(input.validUntil) }),
    }),
  };
}

export function isAssignmentActiveAt(
  assignment: RoleAssignment,
  now: Date,
): boolean {
  const time = now.getTime();
  return (
    assignment.validFrom.getTime() <= time &&
    (assignment.validUntil === undefined ||
      time < assignment.validUntil.getTime())
  );
}

function parseId(raw: string): string | null {
  const id = raw.trim();
  return id && id.length <= 128 ? id : null;
}

function parseIdentityPart(raw: string): string | null {
  return raw.trim() && raw.length <= 255 ? raw : null;
}

function parseScope(scope: unknown): AuthorizationScope | null {
  if (typeof scope !== "object" || scope === null || !("type" in scope)) {
    return null;
  }

  if (scope.type === "GLOBAL") return { type: "GLOBAL" };
  if (scope.type !== "WORLD" || !("worldKey" in scope)) return null;
  if (typeof scope.worldKey !== "string") return null;

  const worldKey = scope.worldKey.trim();
  if (
    worldKey.length < 2 ||
    worldKey.length > 64 ||
    !WORLD_KEY_PATTERN.test(worldKey)
  )
    return null;
  return { type: "WORLD", worldKey };
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function failure(
  code: AccessValidationCode,
  message: string,
): Result<never, AccessValidationError> {
  return { ok: false, error: { code, message } };
}
