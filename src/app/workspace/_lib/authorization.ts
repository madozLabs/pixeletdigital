import type { RequestActor } from "@/shared/request-context";

export function actorHasWorldAccess(
  actor: RequestActor,
  worldKey: string,
): boolean {
  return actor.scopes.some(
    (scope) =>
      scope.type === "GLOBAL" ||
      (scope.type === "WORLD" && scope.worldKey === worldKey),
  );
}

export function requireWorldAccess(
  actor: RequestActor,
  worldKey: string,
): void {
  if (!actorHasWorldAccess(actor, worldKey)) {
    throw new Error("FORBIDDEN_WORLD_SCOPE");
  }
}
