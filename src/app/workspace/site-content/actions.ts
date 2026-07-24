"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/shared/prisma-client";
import { requireWorldAccess } from "../_lib/authorization";
import { getWorkspaceRequestContext } from "../get-workspace-context";

const EDIT_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER", "EDITOR"]);
const PUBLISH_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER"]);

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

async function actorFor(worldKey: string, publish = false) {
  const context = await getWorkspaceRequestContext();
  const actor = context?.actor;
  if (!actor?.active || !actor.role) throw new Error("UNAUTHORIZED");
  requireWorldAccess(actor, worldKey);
  if (!(publish ? PUBLISH_ROLES : EDIT_ROLES).has(actor.role)) {
    throw new Error("FORBIDDEN_ROLE");
  }
  return actor;
}
export async function createPageAction(formData: FormData): Promise<void> {
  const worldKey = text(formData, "worldKey");
  await actorFor(worldKey);
  const now = new Date();
  await prisma.page.create({
    data: {
      id: randomUUID(),
      worldKey,
      pageType: text(formData, "pageType") || "LANDING",
      title: text(formData, "title"),
      slug: text(formData, "slug"),
      lifecycle: "DRAFT",
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
  });
  revalidatePath("/workspace/site-content");
}

export async function updatePageAction(formData: FormData): Promise<void> {
  const id = text(formData, "id");
  const page = await prisma.page.findUniqueOrThrow({ where: { id } });
  await actorFor(page.worldKey);
  if (page.lifecycle !== "DRAFT") throw new Error("PAGE_NOT_DRAFT");
  await prisma.page.update({
    where: { id, version: Number(formData.get("expectedVersion")) },
    data: {
      title: text(formData, "title"),
      slug: text(formData, "slug"),
      version: { increment: 1 },
      updatedAt: new Date(),
    },
  });
  revalidatePath("/workspace/site-content");
}
export async function transitionPageAction(formData: FormData): Promise<void> {
  const id = text(formData, "id");
  const page = await prisma.page.findUniqueOrThrow({ where: { id } });
  const target = text(formData, "target") as
    "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";
  await actorFor(
    page.worldKey,
    target === "PUBLISHED" || target === "ARCHIVED",
  );
  await prisma.page.update({
    where: { id, version: Number(formData.get("expectedVersion")) },
    data: {
      lifecycle: target,
      publishedAt: target === "PUBLISHED" ? new Date() : page.publishedAt,
      version: { increment: 1 },
      updatedAt: new Date(),
    },
  });
  revalidatePath("/workspace/site-content");
}

function parsePayload(raw: string): Record<string, unknown> {
  const value: unknown = JSON.parse(raw || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_SECTION_PAYLOAD");
  }
  return value as Record<string, unknown>;
}
export async function saveSectionAction(formData: FormData): Promise<void> {
  const pageId = text(formData, "pageId");
  const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
  await actorFor(page.worldKey);
  if (page.lifecycle !== "DRAFT") throw new Error("PAGE_NOT_DRAFT");
  const id = text(formData, "id") || randomUUID();
  const now = new Date();
  const payload = parsePayload(text(formData, "payload"));
  await prisma.pageSection.upsert({
    where: { id },
    create: {
      id,
      pageId,
      sectionType: text(formData, "sectionType").toUpperCase(),
      order: Number(formData.get("order")),
      payload: payload as Prisma.InputJsonValue,
      payloadSchemaVersion: 1,
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      sectionType: text(formData, "sectionType").toUpperCase(),
      order: Number(formData.get("order")),
      payload: payload as Prisma.InputJsonValue,
      version: { increment: 1 },
      updatedAt: now,
    },
  });
  revalidatePath("/workspace/site-content");
}

export async function deleteSectionAction(formData: FormData): Promise<void> {
  const id = text(formData, "id");
  const section = await prisma.pageSection.findUniqueOrThrow({
    where: { id },
    include: { page: true },
  });
  await actorFor(section.page.worldKey);
  if (section.page.lifecycle !== "DRAFT") throw new Error("PAGE_NOT_DRAFT");
  await prisma.pageSection.delete({ where: { id } });
  revalidatePath("/workspace/site-content");
}
export async function uploadMediaAction(formData: FormData): Promise<void> {
  const worldKey = text(formData, "worldKey");
  await actorFor(worldKey);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    throw new Error("FILE_REQUIRED");

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey)
    throw new Error("SUPABASE_STORAGE_NOT_CONFIGURED");

  const bucket = process.env.SUPABASE_MEDIA_BUCKET || "site-media";
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  const objectPath = `${worldKey}/${new Date().getUTCFullYear()}/${randomUUID()}-${safeName}`;
  const response = await fetch(
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
  if (!response.ok)
    throw new Error(`SUPABASE_UPLOAD_FAILED:${await response.text()}`);

  await prisma.mediaAsset.create({
    data: {
      worldKey,
      bucket,
      objectPath,
      publicUrl: `${supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`,
      title: text(formData, "title") || file.name,
      altText: text(formData, "altText"),
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      tags: text(formData, "tags")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    },
  });
  revalidatePath("/workspace/site-content");
}

export async function deleteMediaAction(formData: FormData): Promise<void> {
  const id = text(formData, "id");
  const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id } });
  await actorFor(asset.worldKey);
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey) {
    await fetch(
      `${supabaseUrl}/storage/v1/object/${asset.bucket}/${asset.objectPath}`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
      },
    );
  }
  await prisma.mediaAsset.delete({ where: { id } });
  revalidatePath("/workspace/site-content");
}
