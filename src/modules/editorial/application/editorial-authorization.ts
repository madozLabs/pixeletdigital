import type {
  ApprovedRole,
  RequestActor,
  RequestContext,
} from "@/shared/request-context";

import type { Result } from "../domain/editorial-item";
import type { EditorialApplicationError } from "./application-error";

const EDITORIAL_MUTATE_ROLES: readonly ApprovedRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "WORLD_MANAGER",
  "EDITOR",
];

export function requireActiveActor(
  context: RequestContext,
): Result<RequestActor, EditorialApplicationError> {
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

export function mayMutateEditorialCalendar(actor: RequestActor): boolean {
  return actor.role !== null && EDITORIAL_MUTATE_ROLES.includes(actor.role);
}

export function forbidden(): Result<never, EditorialApplicationError> {
  return {
    ok: false,
    error: {
      code: "FORBIDDEN",
      message:
        "The actor is not authorized for this editorial calendar action.",
    },
  };
}
