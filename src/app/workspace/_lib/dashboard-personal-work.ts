const OPEN_TASK_STATUSES = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "REVIEW",
] as const;

const REVIEW_STATUSES = ["INTERNAL_REVIEW", "CLIENT_REVIEW"] as const;
const ACTIVE_LEAD_STATUSES = ["NEW", "IN_REVIEW"] as const;

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
    leads: {
      worldKey: input.worldKey,
      ownerUserId: input.actorId,
      status: { in: [...ACTIVE_LEAD_STATUSES] },
    } satisfies Prisma.LeadWhereInput,
  };
}
import type { Prisma } from "@/generated/prisma/client";
