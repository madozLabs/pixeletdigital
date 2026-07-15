import type { Clock } from "@/shared/clock";
import type {
  RequestContext,
  RequestOriginMetadata,
} from "@/shared/request-context";

import type { AuthenticatedIdentity, Result } from "../domain/access";
import type {
  AuthAccountRepository,
  RoleAssignmentRepository,
  UserRepository,
} from "./access-repositories";
import {
  buildRequestContext,
  type BuildRequestContextError,
} from "./build-request-context";

export type ResolveIdentityRequestContextError =
  | BuildRequestContextError
  | Readonly<{ code: "UNAUTHENTICATED"; message: string }>;

export async function resolveIdentityRequestContext(
  dependencies: Readonly<{
    authAccounts: AuthAccountRepository;
    users: UserRepository;
    roleAssignments: RoleAssignmentRepository;
    clock: Clock;
  }>,
  input: Readonly<{
    identity: AuthenticatedIdentity;
    correlationId: string;
    origin: RequestOriginMetadata;
  }>,
): Promise<Result<RequestContext, ResolveIdentityRequestContextError>> {
  const account = await dependencies.authAccounts.findByIdentity(
    input.identity,
  );
  if (account === null) {
    return {
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message:
          "The authenticated identity is not linked to an internal user.",
      },
    };
  }

  return buildRequestContext(dependencies, {
    userId: account.userId,
    correlationId: input.correlationId,
    origin: input.origin,
  });
}
