import type {
  AuthAccount as PrismaAuthAccount,
  PrismaClient,
  RoleAssignment as PrismaRoleAssignment,
  User as PrismaUser,
  World as PrismaWorld,
} from "@/generated/prisma/client";

import type {
  AuthAccountRepository,
  RoleAssignmentRepository,
  UserRepository,
} from "../application/access-repositories";
import {
  createAuthAccount,
  createRoleAssignment,
  createUser,
  type AuthAccount,
  type AuthenticatedIdentity,
  type RoleAssignment,
  type User,
} from "../domain/access";

type AssignmentRecord = PrismaRoleAssignment & {
  world: Pick<PrismaWorld, "key"> | null;
};

export class PrismaAuthAccountRepository implements AuthAccountRepository {
  constructor(private readonly client: PrismaClient) {}

  async findByIdentity(
    identity: AuthenticatedIdentity,
  ): Promise<AuthAccount | null> {
    const record = await this.client.authAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: identity.provider,
          providerAccountId: identity.providerAccountId,
        },
      },
    });
    return record ? toAuthAccount(record) : null;
  }
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(userId: string): Promise<User | null> {
    const record = await this.client.user.findUnique({ where: { id: userId } });
    return record ? toUser(record) : null;
  }
}
export class PrismaRoleAssignmentRepository implements RoleAssignmentRepository {
  constructor(private readonly client: PrismaClient) {}

  async findByUserId(userId: string): Promise<readonly RoleAssignment[]> {
    const records = await this.client.roleAssignment.findMany({
      where: { userId },
      include: { world: { select: { key: true } } },
      orderBy: { id: "asc" },
    });
    return records.map(toRoleAssignment);
  }
}

function toUser(record: PrismaUser): User {
  const result = createUser(record);
  if (!result.ok) {
    throw new Error(`Persisted User is invalid: ${result.error.code}`);
  }
  return result.value;
}

function toAuthAccount(record: PrismaAuthAccount): AuthAccount {
  const result = createAuthAccount(record);
  if (!result.ok) {
    throw new Error(`Persisted AuthAccount is invalid: ${result.error.code}`);
  }
  return result.value;
}

function toRoleAssignment(record: AssignmentRecord): RoleAssignment {
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
