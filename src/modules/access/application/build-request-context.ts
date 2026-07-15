import type { Clock } from "@/shared/clock";
import type {
  AuthorizationScope,
  RequestContext,
  RequestOriginMetadata,
} from "@/shared/request-context";

import { isAssignmentActiveAt, type Result } from "../domain/access";
import type {
  RoleAssignmentRepository,
  UserRepository,
} from "./access-repositories";

export type BuildRequestContextError = Readonly<{
  code: "FORBIDDEN" | "CONFLICT";
  message: string;
}>;

export async function buildRequestContext(
  dependencies: Readonly<{
    users: UserRepository;
    roleAssignments: RoleAssignmentRepository;
    clock: Clock;
  }>,
  input: Readonly<{
    userId: string;
    correlationId: string;
    origin: RequestOriginMetadata;
  }>,
): Promise<Result<RequestContext, BuildRequestContextError>> {
  const user = await dependencies.users.findById(input.userId);
  const base = {
    correlationId: input.correlationId,
    clock: dependencies.clock,
    origin: input.origin,
  } as const;

  if (user === null) return { ok: true, value: { ...base, actor: null } };
  if (user.status === "INACTIVE") {
    return {
      ok: true,
      value: {
        ...base,
        actor: { id: user.id, active: false, role: null, scopes: [] },
      },
    };
  }

  const now = dependencies.clock.now();
  const assignments = (
    await dependencies.roleAssignments.findByUserId(user.id)
  ).filter((assignment) => isAssignmentActiveAt(assignment, now));
  const roles = new Set(assignments.map((assignment) => assignment.role));

  if (roles.size === 0) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "The active user has no active role assignment.",
      },
    };
  }
  if (roles.size !== 1) {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "The active user has conflicting effective roles.",
      },
    };
  }

  const scopes = deduplicateScopes(
    assignments.map((assignment) => assignment.scope),
  );
  return {
    ok: true,
    value: {
      ...base,
      actor: { id: user.id, active: true, role: [...roles][0]!, scopes },
    },
  };
}

function deduplicateScopes(
  scopes: readonly AuthorizationScope[],
): readonly AuthorizationScope[] {
  const unique = new Map<string, AuthorizationScope>();
  for (const scope of scopes) {
    const key = scope.type === "GLOBAL" ? "GLOBAL" : `WORLD:${scope.worldKey}`;
    if (!unique.has(key)) unique.set(key, scope);
  }
  return [...unique.values()];
}
