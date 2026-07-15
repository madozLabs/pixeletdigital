import type { Session } from "next-auth";

import type { Clock } from "@/shared/clock";
import type {
  RequestContext,
  RequestOriginMetadata,
} from "@/shared/request-context";

import type { Result } from "../domain/access";
import type {
  RoleAssignmentRepository,
  UserRepository,
} from "./access-repositories";
import {
  buildRequestContext,
  type BuildRequestContextError,
} from "./build-request-context";

export type ResolveAuthSessionError =
  | BuildRequestContextError
  | Readonly<{ code: "UNAUTHENTICATED"; message: string }>;
export async function resolveAuthSessionRequestContext(
  dependencies: Readonly<{
    users: UserRepository;
    roleAssignments: RoleAssignmentRepository;
    clock: Clock;
  }>,
  input: Readonly<{
    session: Session | null;
    correlationId: string;
    origin: RequestOriginMetadata;
  }>,
): Promise<Result<RequestContext, ResolveAuthSessionError>> {
  const userId = normalizeSessionUserId(input.session?.user?.id);
  if (!userId) {
    return {
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message:
          "A valid Auth.js session with an internal user id is required.",
      },
    };
  }

  return buildRequestContext(dependencies, {
    userId,
    correlationId: input.correlationId,
    origin: input.origin,
  });
}

function normalizeSessionUserId(raw: string | undefined): string | null {
  const value = raw?.trim() ?? "";
  return value.length > 0 && value.length <= 128 ? value : null;
}
