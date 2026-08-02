export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

// The set of entities a comment can attach to -- deliberately the three
// spots the editorial/tasks audit flagged as having zero asynchronous
// collaboration (score 1/10): tasks, editorial content, and their shared
// container, projects. Extending this list later is a one-line change,
// no migration (entityType is a loose string column, not a DB enum).
export const COMMENTABLE_ENTITY_TYPES = [
  "TASK",
  "EDITORIAL_ITEM",
  "PROJECT",
  "PAGE",
] as const;
export type CommentableEntityType = (typeof COMMENTABLE_ENTITY_TYPES)[number];

export function isCommentableEntityType(
  value: string,
): value is CommentableEntityType {
  return (COMMENTABLE_ENTITY_TYPES as readonly string[]).includes(value);
}

export type CommentDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_ENTITY_TYPE"
  | "INVALID_ENTITY_ID"
  | "INVALID_WORLD_KEY"
  | "INVALID_AUTHOR_ID"
  | "INVALID_BODY"
  | "TOO_MANY_MENTIONS";

export type CommentDomainError = Readonly<{
  code: CommentDomainErrorCode;
  message: string;
}>;

export type Comment = Readonly<{
  id: string;
  entityType: CommentableEntityType;
  entityId: string;
  worldKey: string;
  authorId: string;
  body: string;
  mentionedUserIds: readonly string[];
  createdAt: Date;
}>;

const MAX_BODY_LENGTH = 2000;
const MAX_MENTIONS = 20;

export function postComment(
  input: Readonly<{
    id: string;
    entityType: string;
    entityId: string;
    worldKey: string;
    authorId: string;
    body: string;
    mentionedUserIds?: readonly string[];
    createdAt: Date;
  }>,
): Result<Comment, CommentDomainError> {
  const id = input.id.trim();
  if (!id) {
    return failure(
      "INVALID_ID",
      "Comment id must be a non-empty opaque identifier.",
    );
  }

  if (!isCommentableEntityType(input.entityType)) {
    return failure(
      "INVALID_ENTITY_TYPE",
      "Comment entityType is not part of the controlled vocabulary.",
    );
  }

  const entityId = input.entityId.trim();
  if (!entityId) {
    return failure(
      "INVALID_ENTITY_ID",
      "Comment entityId must be a non-empty identifier.",
    );
  }

  const worldKey = input.worldKey.trim();
  if (!worldKey) {
    return failure(
      "INVALID_WORLD_KEY",
      "Comment worldKey must be a non-empty identifier.",
    );
  }

  const authorId = input.authorId.trim();
  if (!authorId) {
    return failure(
      "INVALID_AUTHOR_ID",
      "Comment authorId must be a non-empty identifier.",
    );
  }

  const body = input.body.trim();
  if (!body || body.length > MAX_BODY_LENGTH) {
    return failure(
      "INVALID_BODY",
      `Le commentaire doit contenir entre 1 et ${MAX_BODY_LENGTH} caractères.`,
    );
  }

  const mentionedUserIds = Array.from(
    new Set((input.mentionedUserIds ?? []).map((id) => id.trim()).filter(Boolean)),
  );
  if (mentionedUserIds.length > MAX_MENTIONS) {
    return failure(
      "TOO_MANY_MENTIONS",
      `Un commentaire ne peut mentionner plus de ${MAX_MENTIONS} personnes.`,
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      entityType: input.entityType,
      entityId,
      worldKey,
      authorId,
      body,
      mentionedUserIds: Object.freeze(mentionedUserIds),
      createdAt: new Date(input.createdAt),
    }),
  };
}

export function restoreComment(
  input: Readonly<{
    id: string;
    entityType: string;
    entityId: string;
    worldKey: string;
    authorId: string;
    body: string;
    mentionedUserIds: readonly string[];
    createdAt: Date;
  }>,
): Result<Comment, CommentDomainError> {
  return postComment(input);
}

function failure(
  code: CommentDomainErrorCode,
  message: string,
): Result<never, CommentDomainError> {
  return { ok: false, error: { code, message } };
}
