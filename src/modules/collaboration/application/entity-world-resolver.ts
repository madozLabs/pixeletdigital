import type { CommentableEntityType } from "../domain/comment";

export interface EntityWorldResolver {
  resolveWorldKey(
    entityType: CommentableEntityType,
    entityId: string,
  ): Promise<string | null>;
}
