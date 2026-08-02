import type { PrismaClient } from "@/generated/prisma/client";

import type { EntityWorldResolver } from "../application/entity-world-resolver";
import type { CommentableEntityType } from "../domain/comment";

export class PrismaEntityWorldResolver implements EntityWorldResolver {
  constructor(private readonly client: PrismaClient) {}

  async resolveWorldKey(
    entityType: CommentableEntityType,
    entityId: string,
  ): Promise<string | null> {
    if (entityType === "PROJECT") {
      const project = await this.client.project.findUnique({
        where: { id: entityId },
        select: { worldKey: true },
      });
      return project?.worldKey ?? null;
    }
    if (entityType === "EDITORIAL_ITEM") {
      const item = await this.client.editorialItem.findUnique({
        where: { id: entityId },
        select: { worldKey: true },
      });
      return item?.worldKey ?? null;
    }
    if (entityType === "PAGE") {
      const page = await this.client.page.findUnique({
        where: { id: entityId },
        select: { worldKey: true },
      });
      return page?.worldKey ?? null;
    }
    // TASK: worldKey lives on the parent project, not on Task itself.
    const task = await this.client.task.findUnique({
      where: { id: entityId },
      select: { project: { select: { worldKey: true } } },
    });
    return task?.project.worldKey ?? null;
  }
}
