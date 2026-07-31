import type {
  ApprovedRole,
  RequestActor,
  RequestContext,
} from "@/shared/request-context";

import type { Result } from "../domain/comment";
import type { CollaborationApplicationError } from "./application-error";

// Commenting is communication, not a data mutation like billing/finance --
// any active, world-scoped actor may read and post, including READER. Only
// moderation (deleting someone else's comment) is role-gated.
const MODERATOR_ROLES: readonly ApprovedRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "WORLD_MANAGER",
];

export function requireActiveActor(
  context: RequestContext,
): Result<RequestActor, CollaborationApplicationError> {
  if (!context.actor?.active) {
    return {
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "An active authenticated actor is required.",
      },
    };
  }

  return { ok: true, value: context.actor };
}

export function hasWorldScope(actor: RequestActor, worldKey: string): boolean {
  return actor.scopes.some(
    (scope) =>
      scope.type === "GLOBAL" ||
      (scope.type === "WORLD" && scope.worldKey === worldKey),
  );
}

export function isModerator(actor: RequestActor): boolean {
  return actor.role !== null && MODERATOR_ROLES.includes(actor.role);
}

export function forbidden(): Result<never, CollaborationApplicationError> {
  return {
    ok: false,
    error: {
      code: "FORBIDDEN",
      message: "The actor is not authorized for this action.",
    },
  };
}
