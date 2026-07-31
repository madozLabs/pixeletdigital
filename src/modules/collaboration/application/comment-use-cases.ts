import { randomUUID } from "node:crypto";

import type { RequestContext } from "@/shared/request-context";

import {
  isCommentableEntityType,
  postComment as postCommentDomain,
  type Comment,
  type CommentableEntityType,
  type Result,
} from "../domain/comment";
import { createNotification } from "../domain/notification";
import type { CollaborationApplicationError } from "./application-error";
import type { CommentRepository } from "./comment-repository";
import type { EntityWorldResolver } from "./entity-world-resolver";
import type { NotificationRepository } from "./notification-repository";
import {
  forbidden,
  hasWorldScope,
  isModerator,
  requireActiveActor,
} from "./collaboration-authorization";

export type CommentDependencies = Readonly<{
  comments: CommentRepository;
  notifications: NotificationRepository;
  worldResolver: EntityWorldResolver;
}>;

export type PostCommentInput = Readonly<{
  entityType: string;
  entityId: string;
  body: string;
  mentionedUserIds?: readonly string[];
}>;

export async function postComment(
  dependencies: CommentDependencies,
  context: RequestContext,
  input: PostCommentInput,
): Promise<Result<Comment, CollaborationApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  if (!isCommentableEntityType(input.entityType)) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: "INVALID_ENTITY_TYPE",
        message: "Type d'entité inconnu.",
      },
    };
  }

  const worldKey = await dependencies.worldResolver.resolveWorldKey(
    input.entityType,
    input.entityId,
  );
  if (!worldKey) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Entity was not found." },
    };
  }
  if (!hasWorldScope(actor, worldKey)) return forbidden();

  const now = context.clock.now();
  const commentResult = postCommentDomain({
    id: randomUUID(),
    entityType: input.entityType,
    entityId: input.entityId,
    worldKey,
    authorId: actor.id,
    body: input.body,
    mentionedUserIds: input.mentionedUserIds,
    createdAt: now,
  });
  if (!commentResult.ok) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: commentResult.error.code,
        message: commentResult.error.message,
      },
    };
  }
  const comment = commentResult.value;

  await dependencies.comments.save(comment);

  // Mentioning yourself is a no-op notification, not an error -- skip it
  // rather than reject the whole comment over it.
  for (const mentionedUserId of comment.mentionedUserIds) {
    if (mentionedUserId === actor.id) continue;
    const notificationResult = createNotification({
      id: randomUUID(),
      userId: mentionedUserId,
      type: "MENTIONED",
      commentId: comment.id,
      entityType: comment.entityType,
      entityId: comment.entityId,
      worldKey: comment.worldKey,
      createdAt: now,
    });
    if (notificationResult.ok) {
      await dependencies.notifications.save(notificationResult.value);
    }
  }

  return { ok: true, value: comment };
}

export type ListCommentsInput = Readonly<{
  entityType: string;
  entityId: string;
}>;

export async function listCommentsForEntity(
  dependencies: CommentDependencies,
  context: RequestContext,
  input: ListCommentsInput,
): Promise<Result<readonly Comment[], CollaborationApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

  if (!isCommentableEntityType(input.entityType)) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: "INVALID_ENTITY_TYPE",
        message: "Type d'entité inconnu.",
      },
    };
  }

  const worldKey = await dependencies.worldResolver.resolveWorldKey(
    input.entityType,
    input.entityId,
  );
  if (!worldKey) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Entity was not found." },
    };
  }
  if (!hasWorldScope(actorResult.value, worldKey)) return forbidden();

  return {
    ok: true,
    value: await dependencies.comments.listByEntity(
      input.entityType as CommentableEntityType,
      input.entityId,
    ),
  };
}

export type DeleteCommentInput = Readonly<{ id: string }>;

export async function deleteComment(
  dependencies: CommentDependencies,
  context: RequestContext,
  input: DeleteCommentInput,
): Promise<Result<Comment, CollaborationApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const comment = await dependencies.comments.findById(input.id);
  if (!comment) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Comment was not found." },
    };
  }
  const isAuthor = comment.authorId === actor.id;
  if (!isAuthor && !(isModerator(actor) && hasWorldScope(actor, comment.worldKey))) {
    return forbidden();
  }

  await dependencies.comments.delete(input.id);
  return { ok: true, value: comment };
}
