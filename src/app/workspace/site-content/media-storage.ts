import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type StoredMedia = Readonly<{ bucket: string; publicUrl: string }>;

type MediaStorageOptions = Readonly<{
  supabaseUrl?: string;
  serviceKey?: string;
  bucket?: string;
  nodeEnv?: string;
  uploadsRoot?: string;
  fetchImpl?: typeof fetch;
}>;

export async function storeWorkspaceMediaFile(
  file: File,
  objectPath: string,
  options: MediaStorageOptions = {},
): Promise<StoredMedia> {
  const supabaseUrl = options.supabaseUrl ?? process.env.SUPABASE_URL;
  const serviceKey =
    options.serviceKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey) {
    const bucket =
      options.bucket ?? process.env.SUPABASE_MEDIA_BUCKET ?? "site-media";
    const fetchImpl = options.fetchImpl ?? fetch;
    const response = await fetchImpl(
      `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "content-type": file.type || "application/octet-stream",
          "x-upsert": "false",
        },
        body: file,
      },
    );
    if (!response.ok) {
      throw new Error(`SUPABASE_UPLOAD_FAILED:${await response.text()}`);
    }
    return {
      bucket,
      publicUrl: `${supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`,
    };
  }

  if ((options.nodeEnv ?? process.env.NODE_ENV) === "production") {
    throw new Error("SUPABASE_STORAGE_NOT_CONFIGURED");
  }
  const uploadsRoot =
    options.uploadsRoot ??
    path.resolve(process.cwd(), "public", "uploads", "media");
  const target = safeLocalTarget(uploadsRoot, objectPath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await file.arrayBuffer()), {
    flag: "wx",
  });
  return {
    bucket: "local-development",
    publicUrl: `/uploads/media/${objectPath.replaceAll("\\", "/")}`,
  };
}

export async function deleteWorkspaceMediaFile(
  objectPath: string,
  options: Pick<MediaStorageOptions, "uploadsRoot"> = {},
): Promise<void> {
  const uploadsRoot =
    options.uploadsRoot ??
    path.resolve(process.cwd(), "public", "uploads", "media");
  const target = safeLocalTarget(uploadsRoot, objectPath);
  await unlink(target).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

function safeLocalTarget(uploadsRoot: string, objectPath: string): string {
  const root = path.resolve(uploadsRoot);
  const target = path.resolve(root, objectPath);
  if (!target.startsWith(`${root}${path.sep}`)) {
    throw new Error("INVALID_MEDIA_PATH");
  }
  return target;
}
