import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  deleteWorkspaceMediaFile,
  storeWorkspaceMediaFile,
} from "./media-storage";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("development media storage", () => {
  it("stores and deletes an uploaded file beneath the isolated local root", async () => {
    const uploadsRoot = await mkdtemp(path.join(tmpdir(), "cms-media-test-"));
    roots.push(uploadsRoot);
    const file = new File([new Uint8Array([1, 2, 3])], "sample.png", {
      type: "image/png",
    });

    const stored = await storeWorkspaceMediaFile(
      file,
      "pixel-digital/2026/sample.png",
      {
        uploadsRoot,
        nodeEnv: "development",
        supabaseUrl: "",
        serviceKey: "",
      },
    );

    expect(stored).toEqual({
      bucket: "local-development",
      publicUrl: "/uploads/media/pixel-digital/2026/sample.png",
    });
    expect(
      await readFile(
        path.join(uploadsRoot, "pixel-digital", "2026", "sample.png"),
      ),
    ).toEqual(Buffer.from([1, 2, 3]));

    await deleteWorkspaceMediaFile("pixel-digital/2026/sample.png", {
      uploadsRoot,
    });
    await expect(
      readFile(path.join(uploadsRoot, "pixel-digital", "2026", "sample.png")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("never falls back to a local disk in production", async () => {
    await expect(
      storeWorkspaceMediaFile(new File(["x"], "x.png"), "x.png", {
        nodeEnv: "production",
        uploadsRoot: "unused",
        supabaseUrl: "",
        serviceKey: "",
      }),
    ).rejects.toThrow("SUPABASE_STORAGE_NOT_CONFIGURED");
  });

  it("rejects paths escaping the configured upload directory", async () => {
    const uploadsRoot = await mkdtemp(path.join(tmpdir(), "cms-media-test-"));
    roots.push(uploadsRoot);
    await expect(
      storeWorkspaceMediaFile(new File(["x"], "x.png"), "../escape.png", {
        nodeEnv: "development",
        uploadsRoot,
        supabaseUrl: "",
        serviceKey: "",
      }),
    ).rejects.toThrow("INVALID_MEDIA_PATH");
  });
});
