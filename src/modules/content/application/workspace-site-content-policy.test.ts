import { describe, expect, it } from "vitest";

import {
  MAX_MEDIA_UPLOAD_BYTES,
  validateWorkspaceMediaUpload,
} from "./workspace-site-content-policy";

describe("workspace site-content policy", () => {
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
