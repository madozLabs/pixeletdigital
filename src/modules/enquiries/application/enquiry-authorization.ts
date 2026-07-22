import type {
  ApprovedRole,
  RequestActor,
  RequestContext,
} from "@/shared/request-context";

import type { Result } from "../domain/enquiry";
import type { EnquiryApplicationError } from "./application-error";

const ENQUIRY_VIEW_ROLES: readonly ApprovedRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "WORLD_MANAGER",
  "SALES",
];

export function requireActiveActor(
  context: RequestContext,
): Result<RequestActor, EnquiryApplicationError> {
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

export function mayViewEnquiries(actor: RequestActor): boolean {
  return actor.role !== null && ENQUIRY_VIEW_ROLES.includes(actor.role);
}

export function forbidden(): Result<never, EnquiryApplicationError> {
  return {
    ok: false,
    error: {
      code: "FORBIDDEN",
      message: "The actor is not authorized for this enquiry action.",
    },
  };
}
