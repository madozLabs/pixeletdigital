const OPEN_TASK_STATUSES = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "REVIEW",
] as const;

const REVIEW_STATUSES = ["INTERNAL_REVIEW", "CLIENT_REVIEW"] as const;
const ACTIVE_LEAD_STATUSES = ["NEW", "IN_REVIEW"] as const;
// E4 (audit éditorial/tâches) : "mon travail" ne couvrait que le rôle de
// relecteur -- un propriétaire de contenu n'y voyait jamais ses propres
// brouillons/productions en cours. Tous les statuts avant publication
// comptent comme "encore à produire" ; PUBLISHED/CANCELLED sont exclus,
// le travail dessus est terminé.
const OWNED_IN_FLIGHT_STATUSES = [
  "DRAFT",
  "INTERNAL_REVIEW",
  "CLIENT_REVIEW",
  "APPROVED",
  "SCHEDULED",
] as const;

export function buildPersonalWorkFilters(input: {
  actorId: string;
  worldKey: string;
}) {
  return {
    tasks: {
      project: { worldKey: input.worldKey },
      assigneeId: input.actorId,
      status: { in: [...OPEN_TASK_STATUSES] },
    } satisfies Prisma.TaskWhereInput,
    reviews: {
      worldKey: input.worldKey,
      reviewerId: input.actorId,
      status: { in: [...REVIEW_STATUSES] },
    } satisfies Prisma.EditorialItemWhereInput,
    editorialOwned: {
      worldKey: input.worldKey,
      ownerId: input.actorId,
      status: { in: [...OWNED_IN_FLIGHT_STATUSES] },
    } satisfies Prisma.EditorialItemWhereInput,
    leads: {
      worldKey: input.worldKey,
      ownerUserId: input.actorId,
      status: { in: [...ACTIVE_LEAD_STATUSES] },
    } satisfies Prisma.LeadWhereInput,
  };
}
import type { Prisma } from "@/generated/prisma/client";
