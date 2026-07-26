import type { ContentLifecycleState } from "../domain/content-lifecycle";

export type WorkspacePageTransitionTarget =
  "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";

type WorkspacePageTransition = Readonly<{
  target: WorkspacePageTransitionTarget;
  requiresReviewRole: boolean;
  changesPublicContent: boolean;
}>;

const PAGE_TRANSITIONS: Readonly<
  Partial<Record<ContentLifecycleState, readonly WorkspacePageTransition[]>>
> = {
  DRAFT: [
    {
      target: "IN_REVIEW",
      requiresReviewRole: false,
      changesPublicContent: false,
    },
  ],
  IN_REVIEW: [
    {
      target: "DRAFT",
      requiresReviewRole: true,
      changesPublicContent: false,
    },
    {
      target: "PUBLISHED",
      requiresReviewRole: true,
      changesPublicContent: true,
    },
  ],
  PUBLISHED: [
    {
      target: "ARCHIVED",
      requiresReviewRole: true,
      changesPublicContent: true,
    },
  ],
};

export function resolveWorkspacePageTransition(
  current: ContentLifecycleState,
  requested: string,
): WorkspacePageTransition | null {
  return (
    PAGE_TRANSITIONS[current]?.find(
      (transition) => transition.target === requested,
    ) ?? null
  );
}

export function sectionBelongsToPage(
  sectionPageId: string,
  authorizedPageId: string,
): boolean {
  return sectionPageId === authorizedPageId;
}

export const MAX_MEDIA_UPLOAD_BYTES = 15 * 1024 * 1024;

const ALLOWED_MEDIA_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export function validateWorkspaceMediaUpload(
  input: Readonly<{
    size: number;
    mimeType: string;
  }>,
): "FILE_TOO_LARGE" | "FILE_TYPE_NOT_ALLOWED" | null {
  if (input.size > MAX_MEDIA_UPLOAD_BYTES) return "FILE_TOO_LARGE";
  if (!ALLOWED_MEDIA_MIME_TYPES.has(input.mimeType)) {
    return "FILE_TYPE_NOT_ALLOWED";
  }
  return null;
}
