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
