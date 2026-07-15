import type { AuditEvent } from "@/modules/audit/application/audit-event";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";

import type {
  AccessAdministrationMutation,
  AccessAdministrationPrecondition,
  AccessAdministrationReader,
  AccessAdministrationTransaction,
} from "../application/access-administration-ports";
import {
  createRoleAssignment,
  createUser,
  type RoleAssignment,
  type User,
} from "../domain/access";

class AccessPreconditionConflict extends Error {}
class AuditPersistenceFailure extends Error {}

type TransactionClient = Prisma.TransactionClient;

export class PrismaAccessAdministrationStore
  implements AccessAdministrationReader, AccessAdministrationTransaction
{
  constructor(private readonly client: PrismaClient) {}

  async findUserById(userId: string): Promise<User | null> {
    const record = await this.client.user.findUnique({ where: { id: userId } });
    return record ? toUser(record) : null;
  }

  async findAssignmentsByUserId(
    userId: string,
  ): Promise<readonly RoleAssignment[]> {
    const records = await this.client.roleAssignment.findMany({
      where: { userId },
      include: { world: { select: { key: true } } },
      orderBy: { id: "asc" },
    });
    return records.map(toRoleAssignment);
  }

  async findAssignmentById(
    assignmentId: string,
  ): Promise<RoleAssignment | null> {
    const record = await this.client.roleAssignment.findUnique({
      where: { id: assignmentId },
      include: { world: { select: { key: true } } },
    });
    return record ? toRoleAssignment(record) : null;
  }

  async commit(input: {
    preconditions: readonly AccessAdministrationPrecondition[];
    mutation: AccessAdministrationMutation;
    auditEvent: AuditEvent;
  }) {
    try {
      await this.client.$transaction(
        async (transaction) => {
          await assertPreconditions(transaction, input.preconditions);
          await applyMutation(transaction, input.mutation);
          await appendAuditEvent(transaction, input.auditEvent);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return { ok: true, value: undefined } as const;
    } catch (error) {
      return mapCommitError(error);
    }
  }
}

async function assertPreconditions(
  transaction: TransactionClient,
  preconditions: readonly AccessAdministrationPrecondition[],
): Promise<void> {
  for (const precondition of preconditions) {
    if (precondition.type === "USER_STATUS_IS") {
      const count = await transaction.user.count({
        where: { id: precondition.userId, status: precondition.status },
      });
      if (count !== 1) throw new AccessPreconditionConflict();
      continue;
    }
    if (precondition.type === "ASSIGNMENT_ACTIVE_AT") {
      const count = await transaction.roleAssignment.count({
        where: {
          id: precondition.assignmentId,
          validFrom: { lte: precondition.at },
          OR: [{ validUntil: null }, { validUntil: { gt: precondition.at } }],
        },
      });
      if (count !== 1) throw new AccessPreconditionConflict();
      continue;
    }
    const worldId = await resolveWorldId(
      transaction,
      precondition.assignment.scope,
    );
    const candidate = precondition.assignment;
    const count = await transaction.roleAssignment.count({
      where: {
        userId: candidate.userId,
        role: candidate.role,
        scopeType: candidate.scope.type,
        worldId,
        validFrom: candidate.validUntil
          ? { lt: candidate.validUntil }
          : undefined,
        OR: [{ validUntil: null }, { validUntil: { gt: candidate.validFrom } }],
      },
    });
    if (count !== 0) throw new AccessPreconditionConflict();
  }
}

async function applyMutation(
  transaction: TransactionClient,
  mutation: AccessAdministrationMutation,
): Promise<void> {
  if (mutation.type === "SET_USER_STATUS") {
    await transaction.user.update({
      where: { id: mutation.user.id },
      data: { status: mutation.user.status },
    });
    return;
  }
  const assignment = mutation.assignment;
  const worldId = await resolveWorldId(transaction, assignment.scope);
  const data = {
    userId: assignment.userId,
    role: assignment.role,
    scopeType: assignment.scope.type,
    worldId,
    validFrom: assignment.validFrom,
    validUntil: assignment.validUntil ?? null,
  };
  const existing = await transaction.roleAssignment.findUnique({
    where: { id: assignment.id },
    select: { id: true },
  });
  if (existing) {
    await transaction.roleAssignment.update({
      where: { id: assignment.id },
      data,
    });
  } else {
    await transaction.roleAssignment.create({
      data: { id: assignment.id, ...data },
    });
  }
}

async function appendAuditEvent(
  transaction: TransactionClient,
  event: AuditEvent,
): Promise<void> {
  const worldId = event.worldKey
    ? await resolveAuditWorldId(transaction, event.worldKey)
    : null;
  await transaction.auditEvent.create({
    data: {
      id: event.id,
      occurredAt: event.occurredAt,
      actorId: event.actorId,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      result: event.result,
      correlationId: event.correlationId,
      originChannel: event.origin.channel,
      worldId,
    },
  });
}

async function resolveAuditWorldId(
  transaction: TransactionClient,
  worldKey: string,
): Promise<string> {
  const world = await transaction.world.findUnique({
    where: { key: worldKey },
    select: { id: true },
  });
  if (!world) throw new AuditPersistenceFailure();
  return world.id;
}

async function resolveWorldId(
  transaction: TransactionClient,
  scope: RoleAssignment["scope"],
): Promise<string | null> {
  if (scope.type === "GLOBAL") return null;
  const world = await transaction.world.findUnique({
    where: { key: scope.worldKey },
    select: { id: true },
  });
  if (!world) throw new AccessPreconditionConflict();
  return world.id;
}

function mapCommitError(error: unknown) {
  if (error instanceof AccessPreconditionConflict) {
    return conflictResult();
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return conflictResult();
  }
  return {
    ok: false,
    error: {
      code: "DEPENDENCY_UNAVAILABLE",
      message: "Atomic Access and Audit persistence failed.",
    },
  } as const;
}

function conflictResult() {
  return {
    ok: false,
    error: {
      code: "CONFLICT",
      message: "Access state changed before the transaction committed.",
    },
  } as const;
}

function toUser(record: { id: string; status: string }): User {
  const result = createUser(record);
  if (!result.ok) {
    throw new Error(`Persisted User is invalid: ${result.error.code}`);
  }
  return result.value;
}

function toRoleAssignment(record: {
  id: string;
  userId: string;
  role: string;
  scopeType: string;
  validFrom: Date;
  validUntil: Date | null;
  world: { key: string } | null;
}): RoleAssignment {
  const scope =
    record.scopeType === "GLOBAL"
      ? { type: "GLOBAL" as const }
      : { type: "WORLD" as const, worldKey: record.world?.key };
  const result = createRoleAssignment({
    id: record.id,
    userId: record.userId,
    role: record.role,
    scope,
    validFrom: record.validFrom,
    ...(record.validUntil ? { validUntil: record.validUntil } : {}),
  });
  if (!result.ok) {
    throw new Error(
      `Persisted RoleAssignment is invalid: ${result.error.code}`,
    );
  }
  return result.value;
}
