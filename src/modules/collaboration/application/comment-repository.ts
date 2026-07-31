import type { CommentableEntityType, Comment } from "../domain/comment";

export interface CommentRepository {
  findById(id: string): Promise<Comment | null>;
  listByEntity(
    entityType: CommentableEntityType,
    entityId: string,
  ): Promise<readonly Comment[]>;
  /** Persists the comment row and its CommentMention rows together. */
  save(comment: Comment): Promise<void>;
  delete(id: string): Promise<void>;
}
