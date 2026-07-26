import type { RequestContext } from "@/shared/request-context";

export type AccessUserDto = Readonly<{
  id: string;
  displayName: string | null;
  normalizedEmail: string | null;
  status: "ACTIVE" | "INACTIVE";
  roleAssignments: readonly Readonly<{
    id: string;
    role: string;
    scopeType: string;
    validFrom: Date;
    validUntil: Date | null;
    world: Readonly<{ displayName: string; key: string }> | null;
  }>[];
}>;

export type UserOptionDto = Readonly<{
  id: string;
  displayName: string | null;
  normalizedEmail: string | null;
}>;

export interface AccessReadModel {
  listOverview(input: {
    skip: number;
    take: number;
  }): Promise<
    Readonly<{ users: readonly AccessUserDto[]; totalUsers: number }>
  >;
  listActiveUserOptions(): Promise<readonly UserOptionDto[]>;
}

export async function listAccessOverview(
  dependencies: Readonly<{ accessReadModel: AccessReadModel }>,
  context: RequestContext,
  input: Readonly<{ skip: number; take: number }>,
) {
  if (!context.actor?.active || context.actor.role !== "SUPER_ADMIN") {
    return { ok: false as const, error: { code: "FORBIDDEN" as const } };
  }
  return {
    ok: true as const,
    value: await dependencies.accessReadModel.listOverview(input),
  };
}

export async function listActiveUserOptions(
  dependencies: Readonly<{ accessReadModel: AccessReadModel }>,
  context: RequestContext,
) {
  if (!context.actor?.active) {
    return { ok: false as const, error: { code: "UNAUTHENTICATED" as const } };
  }
  return {
    ok: true as const,
    value: await dependencies.accessReadModel.listActiveUserOptions(),
  };
}
