import type { AuditEvent } from "@/modules/audit/application/audit-event";
import type {
  AuthorizationScope,
  RequestActor,
  RequestContext,
} from "@/shared/request-context";

import {
  createAuthAccount,
  createRoleAssignment,
  createUser,
  isAssignmentActiveAt,
  type AccessValidationCode,
  type AuthAccount,
  type Result,
  type RoleAssignment,
  type User,
  type UserStatus,
} from "../domain/access";
import type {
  AccessAdministrationReader,
  AccessAdministrationTransaction,
} from "./access-administration-ports";

export type AccessAdministrationError =
  | Readonly<{ code: "UNAUTHENTICATED"; message: string }>
  | Readonly<{ code: "FORBIDDEN"; message: string }>
  | Readonly<{
      code: "VALIDATION_ERROR";
      message: string;
      domainCode?: AccessValidationCode;
    }>
  | Readonly<{ code: "NOT_FOUND"; message: string }>
  | Readonly<{ code: "CONFLICT"; message: string }>
  | Readonly<{ code: "DEPENDENCY_UNAVAILABLE"; message: string }>;
type Dependencies = Readonly<{
  reader: AccessAdministrationReader;
  transaction: AccessAdministrationTransaction;
  employeePolicy: Readonly<{ allowedDomain: string }>;
}>;

type ConfirmationInput = Readonly<{
  confirmed: boolean;
  auditEventId: string;
}>;

export type CreateEmployeeInput = ConfirmationInput &
  Readonly<{
    userId: string;
    displayName: string;
    email: string;
    authAccountId: string;
    provider: string;
    providerAccountId: string;
    assignmentId: string;
    role: string;
    scope: unknown;
    validFrom: Date;
    validUntil?: Date;
  }>;

export type CreatedEmployee = Readonly<{
  user: User;
  authAccount: AuthAccount;
  assignment: RoleAssignment;
}>;

export async function createEmployee(
  dependencies: Dependencies,
  context: RequestContext,
  input: CreateEmployeeInput,
): Promise<Result<CreatedEmployee, AccessAdministrationError>> {
  const confirmation = requireConfirmation(input.confirmed);
  if (!confirmation.ok) return confirmation;
  const actor = requireRoleAdministrator(context);
  if (!actor.ok) return actor;

  const allowedDomain = normalizeAllowedDomain(
    dependencies.employeePolicy.allowedDomain,
  );
  const normalizedEmail = input.email.trim().toLowerCase();
  if (!allowedDomain || emailDomain(normalizedEmail) !== allowedDomain) {
    return validationError(
      "INVALID_EMAIL",
      "Email must belong to the configured allowed domain.",
    );
  }
  const user = createUser({
    id: input.userId,
    displayName: input.displayName,
    normalizedEmail,
    status: "ACTIVE",
  });
  if (!user.ok) return validationError(user.error.code, user.error.message);
  if (!user.value.displayName || !user.value.normalizedEmail) {
    return validationError(
      "INVALID_EMAIL",
      "Provisioned employees require a display name and professional email.",
    );
  }
  const employeeUser = {
    ...user.value,
    displayName: user.value.displayName,
    normalizedEmail: user.value.normalizedEmail,
  } as const;
  const authAccount = createAuthAccount({
    id: input.authAccountId,
    userId: user.value.id,
    provider: input.provider,
    providerAccountId: input.providerAccountId,
  });
  if (!authAccount.ok)
    return validationError(authAccount.error.code, authAccount.error.message);
  const assignment = createRoleAssignment({
    id: input.assignmentId,
    userId: user.value.id,
    role: input.role,
    scope: input.scope,
    validFrom: input.validFrom,
    ...(input.validUntil === undefined ? {} : { validUntil: input.validUntil }),
  });
  if (!assignment.ok)
    return validationError(assignment.error.code, assignment.error.message);

  const auditEvent = createAuditEvent(
    context,
    input.auditEventId,
    context.clock.now(),
    {
      action: "ACCESS_USER_CREATED",
      targetType: "USER",
      targetId: user.value.id,
      worldKey: worldKeyFromScope(assignment.value.scope),
    },
  );
  if (!auditEvent.ok) return auditEvent;
  const committed = await dependencies.transaction.commit({
    preconditions: [
      {
        type: "EMPLOYEE_IDENTIFIERS_AVAILABLE",
        userId: employeeUser.id,
        normalizedEmail: employeeUser.normalizedEmail,
        authAccountId: authAccount.value.id,
        provider: authAccount.value.provider,
        providerAccountId: authAccount.value.providerAccountId,
        assignmentId: assignment.value.id,
      },
    ],
    mutation: {
      type: "CREATE_EMPLOYEE",
      user: employeeUser,
      authAccount: authAccount.value,
      assignment: assignment.value,
    },
    auditEvent: auditEvent.value,
  });
  if (!committed.ok) return committed;
  return {
    ok: true,
    value: {
      user: employeeUser,
      authAccount: authAccount.value,
      assignment: assignment.value,
    },
  };
}

export async function activateUser(
  dependencies: Dependencies,
  context: RequestContext,
  input: ConfirmationInput & Readonly<{ targetUserId: string }>,
): Promise<Result<User, AccessAdministrationError>> {
  return setUserStatus(dependencies, context, input, "ACTIVE");
}

export async function deactivateUser(
  dependencies: Dependencies,
  context: RequestContext,
  input: ConfirmationInput & Readonly<{ targetUserId: string }>,
): Promise<Result<User, AccessAdministrationError>> {
  return setUserStatus(dependencies, context, input, "INACTIVE");
}

export type AssignRoleScopeInput = ConfirmationInput &
  Readonly<{
    assignmentId: string;
    targetUserId: string;
    role: string;
    scope: unknown;
    validFrom: Date;
    validUntil?: Date;
  }>;
export async function assignRoleScope(
  dependencies: Dependencies,
  context: RequestContext,
  input: AssignRoleScopeInput,
): Promise<Result<RoleAssignment, AccessAdministrationError>> {
  const confirmation = requireConfirmation(input.confirmed);
  if (!confirmation.ok) return confirmation;
  const actor = requireRoleAdministrator(context);
  if (!actor.ok) return actor;

  const assignment = createRoleAssignment({
    id: input.assignmentId,
    userId: input.targetUserId,
    role: input.role,
    scope: input.scope,
    validFrom: input.validFrom,
    ...(input.validUntil === undefined ? {} : { validUntil: input.validUntil }),
  });
  if (!assignment.ok)
    return validationError(assignment.error.code, assignment.error.message);
  const target = await dependencies.reader.findUserById(
    assignment.value.userId,
  );
  if (!target) return notFound("Target user was not found.");
  const existing = await dependencies.reader.findAssignmentsByUserId(target.id);
  if (hasOverlappingDuplicate(existing, assignment.value)) {
    return conflict("An overlapping role and scope assignment already exists.");
  }

  const occurredAt = context.clock.now();
  const auditEvent = createAuditEvent(context, input.auditEventId, occurredAt, {
    action: "ACCESS_ROLE_ASSIGNED",
    targetType: "ROLE_ASSIGNMENT",
    targetId: assignment.value.id,
    worldKey: worldKeyFromScope(assignment.value.scope),
  });
  if (!auditEvent.ok) return auditEvent;
  const committed = await dependencies.transaction.commit({
    preconditions: [
      {
        type: "NO_OVERLAPPING_ASSIGNMENT",
        assignment: assignment.value,
      },
    ],
    mutation: { type: "SAVE_ASSIGNMENT", assignment: assignment.value },
    auditEvent: auditEvent.value,
  });
  if (!committed.ok) return committed;
  return { ok: true, value: assignment.value };
}
export async function revokeRoleScope(
  dependencies: Dependencies,
  context: RequestContext,
  input: ConfirmationInput & Readonly<{ assignmentId: string }>,
): Promise<Result<RoleAssignment, AccessAdministrationError>> {
  const confirmation = requireConfirmation(input.confirmed);
  if (!confirmation.ok) return confirmation;
  const actor = requireRoleAdministrator(context);
  if (!actor.ok) return actor;
  const assignmentId = normalizeOpaqueId(input.assignmentId);
  if (!assignmentId)
    return validationError(undefined, "Assignment id is invalid.");

  const existing = await dependencies.reader.findAssignmentById(assignmentId);
  if (!existing) return notFound("Role assignment was not found.");
  if (!(await dependencies.reader.findUserById(existing.userId))) {
    return notFound("Target user was not found.");
  }
  const occurredAt = context.clock.now();
  if (!isAssignmentActiveAt(existing, occurredAt)) {
    return conflict("Only an active role assignment can be revoked.");
  }
  const revoked = createRoleAssignment({
    ...existing,
    scope: existing.scope,
    validUntil: occurredAt,
  });
  if (!revoked.ok)
    return validationError(revoked.error.code, revoked.error.message);
  const auditEvent = createAuditEvent(context, input.auditEventId, occurredAt, {
    action: "ACCESS_ROLE_REVOKED",
    targetType: "ROLE_ASSIGNMENT",
    targetId: revoked.value.id,
    worldKey: worldKeyFromScope(revoked.value.scope),
  });
  if (!auditEvent.ok) return auditEvent;
  const committed = await dependencies.transaction.commit({
    preconditions: [
      {
        type: "ASSIGNMENT_ACTIVE_AT",
        assignmentId: existing.id,
        at: occurredAt,
      },
    ],
    mutation: { type: "SAVE_ASSIGNMENT", assignment: revoked.value },
    auditEvent: auditEvent.value,
  });
  if (!committed.ok) return committed;
  return { ok: true, value: revoked.value };
}
async function setUserStatus(
  dependencies: Dependencies,
  context: RequestContext,
  input: ConfirmationInput & Readonly<{ targetUserId: string }>,
  status: UserStatus,
): Promise<Result<User, AccessAdministrationError>> {
  const confirmation = requireConfirmation(input.confirmed);
  if (!confirmation.ok) return confirmation;
  const actor = requireAccessAdministrator(context);
  if (!actor.ok) return actor;
  const targetUserId = normalizeOpaqueId(input.targetUserId);
  if (!targetUserId)
    return validationError(undefined, "Target user id is invalid.");
  if (status === "INACTIVE" && targetUserId === actor.value.id) {
    return forbidden("An administrator cannot deactivate their own account.");
  }

  const target = await dependencies.reader.findUserById(targetUserId);
  if (!target) return notFound("Target user was not found.");
  const now = context.clock.now();
  const assignments = await dependencies.reader.findAssignmentsByUserId(
    target.id,
  );
  if (
    actor.value.role !== "SUPER_ADMIN" &&
    assignments.some(
      (assignment) =>
        assignment.role === "SUPER_ADMIN" &&
        isAssignmentActiveAt(assignment, now),
    )
  ) {
    return forbidden();
  }
  if (target.status === status) {
    return conflict(`User is already ${status.toLowerCase()}.`);
  }

  const updated = createUser({ ...target, status });
  if (!updated.ok)
    return validationError(updated.error.code, updated.error.message);
  const auditEvent = createAuditEvent(context, input.auditEventId, now, {
    action:
      status === "ACTIVE" ? "ACCESS_USER_ACTIVATED" : "ACCESS_USER_DEACTIVATED",
    targetType: "USER",
    targetId: updated.value.id,
  });
  if (!auditEvent.ok) return auditEvent;
  const committed = await dependencies.transaction.commit({
    preconditions: [
      {
        type: "USER_STATUS_IS",
        userId: target.id,
        status: target.status,
      },
    ],
    mutation: { type: "SET_USER_STATUS", user: updated.value },
    auditEvent: auditEvent.value,
  });
  if (!committed.ok) return committed;
  return { ok: true, value: updated.value };
}
function requireAccessAdministrator(
  context: RequestContext,
): Result<
  RequestActor & { role: "SUPER_ADMIN" | "ADMIN" },
  AccessAdministrationError
> {
  const actor = context.actor;
  if (!actor?.active || actor.role === null) {
    return {
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "An active actor is required.",
      },
    };
  }
  const hasGlobalScope = actor.scopes.some((scope) => scope.type === "GLOBAL");
  if (
    !hasGlobalScope ||
    (actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN")
  ) {
    return forbidden();
  }
  return {
    ok: true,
    value: actor as RequestActor & { role: "SUPER_ADMIN" | "ADMIN" },
  };
}

function requireRoleAdministrator(
  context: RequestContext,
): Result<RequestActor & { role: "SUPER_ADMIN" }, AccessAdministrationError> {
  const actor = requireAccessAdministrator(context);
  if (!actor.ok) return actor;
  if (actor.value.role !== "SUPER_ADMIN") return forbidden();
  return {
    ok: true,
    value: actor.value as RequestActor & { role: "SUPER_ADMIN" },
  };
}

function requireConfirmation(
  confirmed: boolean,
): Result<void, AccessAdministrationError> {
  return confirmed
    ? { ok: true, value: undefined }
    : validationError(undefined, "Deliberate confirmation is required.");
}

function createAuditEvent(
  context: RequestContext,
  auditEventId: string,
  occurredAt: Date,
  input: Omit<
    AuditEvent,
    "id" | "occurredAt" | "actorId" | "result" | "correlationId" | "origin"
  >,
): Result<AuditEvent, AccessAdministrationError> {
  const id = normalizeOpaqueId(auditEventId);
  if (!id || !context.actor)
    return validationError(undefined, "Audit event id is invalid.");
  return {
    ok: true,
    value: {
      id,
      occurredAt,
      actorId: context.actor.id,
      result: "SUCCEEDED",
      correlationId: context.correlationId,
      origin: context.origin,
      ...input,
    },
  };
}
function hasOverlappingDuplicate(
  existing: readonly RoleAssignment[],
  candidate: RoleAssignment,
): boolean {
  return existing.some(
    (assignment) =>
      assignment.role === candidate.role &&
      sameScope(assignment.scope, candidate.scope) &&
      intervalsOverlap(assignment, candidate),
  );
}

function sameScope(
  left: AuthorizationScope,
  right: AuthorizationScope,
): boolean {
  return (
    left.type === right.type &&
    (left.type === "GLOBAL" ||
      (right.type === "WORLD" && left.worldKey === right.worldKey))
  );
}

function intervalsOverlap(
  left: RoleAssignment,
  right: RoleAssignment,
): boolean {
  const leftEnd = left.validUntil?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightEnd = right.validUntil?.getTime() ?? Number.POSITIVE_INFINITY;
  return (
    left.validFrom.getTime() < rightEnd && right.validFrom.getTime() < leftEnd
  );
}

function worldKeyFromScope(scope: AuthorizationScope): string | undefined {
  return scope.type === "WORLD" ? scope.worldKey : undefined;
}

function normalizeOpaqueId(raw: string): string | null {
  const value = raw.trim();
  return value.length > 0 && value.length <= 128 ? value : null;
}

function normalizeAllowedDomain(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value || value.length > 253 || value.includes("@")) return null;
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(value)) return null;
  return value;
}

function emailDomain(normalizedEmail: string): string | null {
  const separator = normalizedEmail.lastIndexOf("@");
  if (separator <= 0 || normalizedEmail.indexOf("@") !== separator) return null;
  return normalizedEmail.slice(separator + 1);
}

function validationError(
  domainCode: AccessValidationCode | undefined,
  message: string,
): Result<never, AccessAdministrationError> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message,
      ...(domainCode ? { domainCode } : {}),
    },
  };
}

function forbidden(
  message = "The actor is not authorized for this access action.",
): Result<never, AccessAdministrationError> {
  return { ok: false, error: { code: "FORBIDDEN", message } };
}

function notFound(message: string): Result<never, AccessAdministrationError> {
  return { ok: false, error: { code: "NOT_FOUND", message } };
}

function conflict(message: string): Result<never, AccessAdministrationError> {
  return { ok: false, error: { code: "CONFLICT", message } };
}
