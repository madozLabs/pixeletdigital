import type {
  ApprovedRole,
  RequestActor,
  RequestContext,
} from "@/shared/request-context";

import type { Result } from "../domain/content-lifecycle";
import type { ContentApplicationError } from "./application-error";

const CONTENT_MUTATE_ROLES: readonly ApprovedRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "WORLD_MANAGER",
  "EDITOR",
];

const CONTENT_REVIEW_ROLES: readonly ApprovedRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "WORLD_MANAGER",
];

const SERVICE_APPROVAL_ROLES: readonly ApprovedRole[] = ["SUPER_ADMIN"];

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

export function mayMutateContent(actor: RequestActor): boolean {
  return actor.role !== null && CONTENT_MUTATE_ROLES.includes(actor.role);
}

export function mayReviewContent(actor: RequestActor): boolean {
  return actor.role !== null && CONTENT_REVIEW_ROLES.includes(actor.role);
}

export function mayApproveServiceAvailability(actor: RequestActor): boolean {
  return actor.role !== null && SERVICE_APPROVAL_ROLES.includes(actor.role);
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
