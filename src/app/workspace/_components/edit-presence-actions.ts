"use server";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { requireWorldAccess } from "../_lib/authorization";
import { getWorkspaceRequestContext } from "../get-workspace-context";

export type PresenceEntityType = "PAGE" | "PROJECT";
export type PresenceViewer = Readonly<{ id: string; name: string }>;

const ACTIVE_WINDOW_MS = 75_000;

async function authorize(entityType: PresenceEntityType, entityId: string) {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor?.active) throw new Error("UNAUTHORIZED");
  const entity =
    entityType === "PAGE"
      ? await prisma.page.findUnique({
          where: { id: entityId },
          select: { worldKey: true },
        })
      : await prisma.project.findUnique({
          where: { id: entityId },
          select: { worldKey: true },
        });
  if (!entity) throw new Error("NOT_FOUND");
  requireWorldAccess(context.actor, entity.worldKey);
  return { actor: context.actor, now: context.clock.now() };
}

export async function heartbeatEditPresence(
  entityType: PresenceEntityType,
  entityId: string,
): Promise<readonly PresenceViewer[]> {
  const { actor, now } = await authorize(entityType, entityId);
  const activeSince = new Date(now.getTime() - ACTIVE_WINDOW_MS);
  await prisma.$transaction([
    prisma.editPresence.deleteMany({
      where: { entityType, entityId, lastSeenAt: { lt: activeSince } },
    }),
    prisma.editPresence.upsert({
      where: {
        userId_entityType_entityId: { userId: actor.id, entityType, entityId },
      },
      create: { userId: actor.id, entityType, entityId, lastSeenAt: now },
      update: { lastSeenAt: now },
    }),
  ]);
  const viewers = await prisma.editPresence.findMany({
    where: {
      entityType,
      entityId,
      userId: { not: actor.id },
      lastSeenAt: { gte: activeSince },
    },
    select: {
      user: { select: { id: true, displayName: true, normalizedEmail: true } },
    },
    orderBy: { lastSeenAt: "desc" },
  });
  return viewers.map(({ user }) => ({
    id: user.id,
    name: user.displayName || user.normalizedEmail || "Un collègue",
  }));
}

export async function leaveEditPresence(
  entityType: PresenceEntityType,
  entityId: string,
): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor?.active) return;
  await prisma.editPresence.deleteMany({
    where: { userId: context.actor.id, entityType, entityId },
  });
}
