import type {
  ApprovedRole,
  RequestActor,
  RequestContext,
} from "@/shared/request-context";

import type { Result, WorldKey } from "../domain/world";
import type { WorldApplicationError } from "./application-error";

const WORLD_UPDATE_ROLES: readonly ApprovedRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "WORLD_MANAGER",
];

export function requireActiveActor(
  context: RequestContext,
): Result<RequestActor, WorldApplicationError> {
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

export function hasWorldScope(
  actor: RequestActor,
  worldKey: WorldKey,
): boolean {
  return actor.scopes.some(
    (scope) =>
      scope.type === "GLOBAL" ||
      (scope.type === "WORLD" && scope.worldKey === worldKey),
  );
}

export function hasMatchingWorldScope(
  actor: RequestActor,
  worldKey: WorldKey,
): boolean {
  return actor.scopes.some(
    (scope) => scope.type === "WORLD" && scope.worldKey === worldKey,
  );
}

export function mayAttemptWorldUpdate(actor: RequestActor): boolean {
  return WORLD_UPDATE_ROLES.includes(actor.role);
}

export function forbidden(): Result<never, WorldApplicationError> {
  return {
    ok: false,
    error: {
      code: "FORBIDDEN",
      message: "The actor is not authorized for this world action.",
    },
  };
}
