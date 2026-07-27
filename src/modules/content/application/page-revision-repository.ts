import type { PageRevision } from "../domain/page-revision";

export type RevisionPageState = Readonly<{
  id: string;
  worldKey: string;
  draftRevisionId: string | null;
  publishedRevisionId: string | null;
}>;

export interface PageRevisionRepository {
  findPage(id: string): Promise<RevisionPageState | null>;
  findRevision(id: string): Promise<PageRevision | null>;
  createDraftFromPublished(input: {
    pageId: string;
    sourceRevisionId: string | null;
    actorId: string;
    now: Date;
  }): Promise<PageRevision>;
  saveDraft(input: {
    revision: PageRevision;
    expectedVersion: number;
  }): Promise<boolean>;
  saveTransition(input: {
    revision: PageRevision;
    expectedVersion: number;
    publish: boolean;
  }): Promise<boolean>;
}
