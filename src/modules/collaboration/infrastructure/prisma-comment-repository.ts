import type {
  Comment as PrismaComment,
  CommentMention,
  PrismaClient,
} from "@/generated/prisma/client";

import type { CommentRepository } from "../application/comment-repository";
import {
  restoreComment,
  type Comment,
  type CommentableEntityType,
} from "../domain/comment";

type PrismaCommentWithMentions = PrismaComment & { mentions: CommentMention[] };

export class PrismaCommentRepository implements CommentRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(id: string): Promise<Comment | null> {
    const record = await this.client.comment.findUnique({
      where: { id },
      include: { mentions: true },
    });
    return record ? toDomain(record) : null;
  }

  async listByEntity(
    entityType: CommentableEntityType,
    entityId: string,
  ): Promise<readonly Comment[]> {
    const records = await this.client.comment.findMany({
      where: { entityType, entityId },
      include: { mentions: true },
      orderBy: { createdAt: "asc" },
    });
    return records.map(toDomain);
  }

  async save(comment: Comment): Promise<void> {
    await this.client.comment.create({
      data: {
        id: comment.id,
        entityType: comment.entityType,
        entityId: comment.entityId,
        worldKey: comment.worldKey,
        authorId: comment.authorId,
        body: comment.body,
        createdAt: comment.createdAt,
      },
    });
    for (const mentionedUserId of comment.mentionedUserIds) {
      await this.client.commentMention.create({
        data: {
          id: `${comment.id}_${mentionedUserId}`,
          commentId: comment.id,
          mentionedUserId,
          createdAt: comment.createdAt,
        },
      });
    }
  }

  async delete(id: string): Promise<void> {
    await this.client.comment.delete({ where: { id } });
  }
}

function toDomain(record: PrismaCommentWithMentions): Comment {
  const result = restoreComment({
    ...record,
    mentionedUserIds: record.mentions.map((mention) => mention.mentionedUserId),
  });
  if (!result.ok) {
    throw new Error(`Persisted Comment is invalid: ${result.error.code}`);
  }
  return result.value;
}
