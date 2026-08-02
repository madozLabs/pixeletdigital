import type { PrismaClient } from "@/generated/prisma/client";

// Lightweight "publish on next read" mechanism -- there is no cron runner
// in this deployment, so instead of a scheduled job, every public page
// load first sweeps its own world for APPROVED revisions whose scheduled
// time has passed and flips them live. Mirrors the PUBLISHED branch of
// PrismaPageRevisionRepository.saveTransition exactly, but runs without a
// human actor (publishedById falls back to whoever approved the
// revision -- they are the one who scheduled it going live).
export async function publishDueScheduledRevisions(
  prisma: PrismaClient,
  worldKey: string,
  now: Date,
): Promise<number> {
  const due = await prisma.pageRevision.findMany({
    where: {
      status: "APPROVED",
      scheduledPublishAt: { lte: now },
      draftForPages: { some: { worldKey } },
    },
    select: { id: true, pageId: true, reviewedById: true, createdById: true },
  });

  for (const revision of due) {
    await prisma.$transaction(async (transaction) => {
      const page = await transaction.page.findUnique({
        where: { id: revision.pageId },
        select: { publishedRevisionId: true, draftRevisionId: true },
      });
      if (page?.draftRevisionId !== revision.id) return;

      if (page.publishedRevisionId) {
        await transaction.pageRevision.updateMany({
          where: { id: page.publishedRevisionId, status: "PUBLISHED" },
          data: { status: "SUPERSEDED", version: { increment: 1 }, updatedAt: now },
        });
      }
      await transaction.pageRevision.update({
        where: { id: revision.id },
        data: {
          status: "PUBLISHED",
          publishedById: revision.reviewedById ?? revision.createdById,
          publishedAt: now,
          scheduledPublishAt: null,
          version: { increment: 1 },
          updatedAt: now,
        },
      });
      await transaction.page.update({
        where: { id: revision.pageId },
        data: {
          lifecycle: "PUBLISHED",
          publishedAt: now,
          publishedRevisionId: revision.id,
          draftRevisionId: null,
          version: { increment: 1 },
          updatedAt: now,
        },
      });
    });
  }

  return due.length;
}
