import type {
  ApprovedRole,
  RequestActor,
  RequestContext,
} from "@/shared/request-context";

import type { Result } from "../domain/page";
import type { ContentApplicationError } from "./application-error";

const PAGE_MUTATE_ROLES: readonly ApprovedRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "WORLD_MANAGER",
  "EDITOR",
];

const PAGE_REVIEW_ROLES: readonly ApprovedRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "WORLD_MANAGER",
];

export function requireActiveActor(
  context: RequestContext,
): Result<RequestActor, ContentApplicationError> {
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

export function mayMutatePages(actor: RequestActor): boolean {
  return actor.role !== null && PAGE_MUTATE_ROLES.includes(actor.role);
}

export function mayReviewPages(actor: RequestActor): boolean {
  return actor.role !== null && PAGE_REVIEW_ROLES.includes(actor.role);
}

export function forbidden(): Result<never, ContentApplicationError> {
  return {
    ok: false,
    error: {
      code: "FORBIDDEN",
      message: "The actor is not authorized for this content action.",
    },
  };
}
