"use server";

import { revalidatePath } from "next/cache";

import {
  deleteComment,
  listCommentsForEntity,
  postComment,
} from "@/modules/collaboration/application/comment-use-cases";
import { PrismaCommentRepository } from "@/modules/collaboration/infrastructure/prisma-comment-repository";
import { PrismaEntityWorldResolver } from "@/modules/collaboration/infrastructure/prisma-entity-world-resolver";
import { PrismaNotificationRepository } from "@/modules/collaboration/infrastructure/prisma-notification-repository";
import type { CommentableEntityType } from "@/modules/collaboration/domain/comment";
import { prisma } from "@/infrastructure/shared/prisma-client";

import { getWorkspaceRequestContext } from "../get-workspace-context";

export type CommentDto = Readonly<{
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  mentionedUserIds: readonly string[];
  createdAt: string;
}>;

function dependencies() {
  return {
    comments: new PrismaCommentRepository(prisma),
    notifications: new PrismaNotificationRepository(prisma),
    worldResolver: new PrismaEntityWorldResolver(prisma),
  };
}

export async function listComments(
  entityType: CommentableEntityType,
  entityId: string,
): Promise<readonly CommentDto[]> {
  const context = await getWorkspaceRequestContext();
  if (!context) return [];

  const result = await listCommentsForEntity(dependencies(), context, {
    entityType,
    entityId,
  });
  if (!result.ok) return [];

  const authorIds = Array.from(new Set(result.value.map((c) => c.authorId)));
  const authors = authorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, displayName: true, normalizedEmail: true },
      })
    : [];
  const authorNameById = new Map(
    authors.map((a) => [a.id, a.displayName || a.normalizedEmail || "Collaborateur"]),
  );

  return result.value.map((comment) => ({
    id: comment.id,
    authorId: comment.authorId,
    authorName: authorNameById.get(comment.authorId) ?? "Collaborateur",
    body: comment.body,
    mentionedUserIds: comment.mentionedUserIds,
    createdAt: comment.createdAt.toISOString(),
  }));
}

export type PostCommentResult = Readonly<
  { ok: true } | { ok: false; message: string }
>;

export async function postCommentOnEntity(
  entityType: CommentableEntityType,
  entityId: string,
  body: string,
  mentionedUserIds: readonly string[],
  revalidatePathHint: string,
): Promise<PostCommentResult> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { ok: false, message: "Session expirée." };

  const result = await postComment(dependencies(), context, {
    entityType,
    entityId,
    body,
    mentionedUserIds,
  });
  if (!result.ok) return { ok: false, message: result.error.message };
  revalidatePath(revalidatePathHint);
  return { ok: true };
}

export async function deleteCommentOnEntity(
  commentId: string,
  revalidatePathHint: string,
): Promise<PostCommentResult> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { ok: false, message: "Session expirée." };

  const result = await deleteComment(dependencies(), context, { id: commentId });
  if (!result.ok) return { ok: false, message: result.error.message };
  revalidatePath(revalidatePathHint);
  return { ok: true };
}
