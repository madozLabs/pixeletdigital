import type {
  ApprovedRole,
  RequestActor,
  RequestContext,
} from "@/shared/request-context";

import type { Result } from "../domain/expense-category";
import type { FinanceApplicationError } from "./application-error";

const FINANCE_ROLES: readonly ApprovedRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "WORLD_MANAGER",
];

export function requireActiveActor(
  context: RequestContext,
): Result<RequestActor, FinanceApplicationError> {
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

export function mayAccessFinance(actor: RequestActor): boolean {
  return actor.role !== null && FINANCE_ROLES.includes(actor.role);
}

export function forbidden(): Result<never, FinanceApplicationError> {
  return {
    ok: false,
    error: {
      code: "FORBIDDEN",
      message: "The actor is not authorized for this finance action.",
    },
  };
}
