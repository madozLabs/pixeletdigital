import { describe, expect, it } from "vitest";

import {
  MAX_MEDIA_UPLOAD_BYTES,
  resolveWorkspacePageTransition,
  sectionBelongsToPage,
  validateWorkspaceMediaUpload,
} from "./workspace-site-content-policy";

describe("workspace site-content policy", () => {
  it("allows only the governed page lifecycle transitions", () => {
    expect(resolveWorkspacePageTransition("DRAFT", "IN_REVIEW")).toEqual({
      target: "IN_REVIEW",
      requiresReviewRole: false,
      changesPublicContent: false,
    });
    expect(resolveWorkspacePageTransition("IN_REVIEW", "PUBLISHED")).toEqual({
      target: "PUBLISHED",
      requiresReviewRole: true,
      changesPublicContent: true,
    });
    expect(resolveWorkspacePageTransition("IN_REVIEW", "DRAFT")).toEqual({
      target: "DRAFT",
      requiresReviewRole: true,
      changesPublicContent: false,
    });
    expect(resolveWorkspacePageTransition("PUBLISHED", "ARCHIVED")).toEqual({
      target: "ARCHIVED",
      requiresReviewRole: true,
      changesPublicContent: true,
    });
  });

  it("rejects forged and out-of-order lifecycle transitions", () => {
    expect(resolveWorkspacePageTransition("PUBLISHED", "DRAFT")).toBeNull();
    expect(resolveWorkspacePageTransition("DRAFT", "PUBLISHED")).toBeNull();
    expect(resolveWorkspacePageTransition("DRAFT", "SCHEDULED")).toBeNull();
    expect(resolveWorkspacePageTransition("DRAFT", "anything")).toBeNull();
  });

  it("requires a section to belong to the authorized page", () => {
    expect(sectionBelongsToPage("page-1", "page-1")).toBe(true);
    expect(sectionBelongsToPage("page-2", "page-1")).toBe(false);
  });

  it("enforces the initial safe media allow-list and size ceiling", () => {
    expect(
      validateWorkspaceMediaUpload({
        size: MAX_MEDIA_UPLOAD_BYTES,
        mimeType: "image/jpeg",
      }),
    ).toBeNull();
    expect(
      validateWorkspaceMediaUpload({
        size: MAX_MEDIA_UPLOAD_BYTES + 1,
        mimeType: "image/jpeg",
      }),
    ).toBe("FILE_TOO_LARGE");
    expect(
      validateWorkspaceMediaUpload({ size: 10, mimeType: "image/svg+xml" }),
    ).toBe("FILE_TYPE_NOT_ALLOWED");
    expect(
      validateWorkspaceMediaUpload({ size: 10, mimeType: "text/html" }),
    ).toBe("FILE_TYPE_NOT_ALLOWED");
  });
});
