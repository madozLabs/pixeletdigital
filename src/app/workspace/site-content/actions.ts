"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/shared/prisma-client";
import { recordAuditEvent } from "@/modules/audit/infrastructure/record-audit-event";
import {
  evidencePublicationErrors,
  isEvidenceSectionType,
} from "@/modules/content/domain/evidence-section";
import type { ActionState } from "../_components/feedback";
import { requireWorldAccess } from "../_lib/authorization";
import { getWorkspaceRequestContext } from "../get-workspace-context";

const EDIT_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER", "EDITOR"]);
const PUBLISH_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER"]);

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

// Public pages are ISR-cached (revalidate = 60 in the (marketing)/kwaliti-print
// routes); revalidate the specific public URL on every content change so
// editors see the result immediately instead of waiting out the window.
// The public [slug] catch-all only serves pixel-digital; Kwaliti Print's
// only CMS-driven public route today is its own home page.
function revalidatePublicPage(worldKey: string, slug: string): void {
  if (slug === "accueil") {
    revalidatePath(worldKey === "kwaliti-print" ? "/kwaliti-print" : "/");
    return;
  }
  if (worldKey === "pixel-digital") revalidatePath(`/${slug}`);
}

async function actorFor(worldKey: string, publish = false) {
  const context = await getWorkspaceRequestContext();
  const actor = context?.actor;
  if (!context || !actor?.active || !actor.role) {
    throw new Error("UNAUTHORIZED");
  }
  requireWorldAccess(actor, worldKey);
  if (!(publish ? PUBLISH_ROLES : EDIT_ROLES).has(actor.role)) {
    throw new Error("FORBIDDEN_ROLE");
  }
  return { actor, context };
}

const ERROR_MESSAGE: Readonly<Record<string, string>> = {
  UNAUTHORIZED: "Vous devez être connecté pour effectuer cette action.",
  FORBIDDEN_WORLD_SCOPE: "Vous n'avez pas accès à cet univers.",
  FORBIDDEN_ROLE: "Votre rôle ne permet pas cette action.",
  PAGE_NOT_DRAFT:
    "Cette page n'est plus en brouillon et ne peut plus être modifiée.",
  INVALID_SECTION_PAYLOAD: "Le contenu de la section n'est pas un JSON valide.",
  EVIDENCE_NOT_PUBLISHABLE:
    "Publication impossible : une preuve sociale est incomplète ou non approuvée.",
  FILE_REQUIRED: "Merci de sélectionner un fichier.",
  EDIT_CONFLICT:
    "Cet élément a été modifié par quelqu’un d’autre. Rechargez la page avant de réessayer.",
  SUPABASE_STORAGE_NOT_CONFIGURED:
    "Le stockage média n'est pas configuré sur cet environnement.",
};

function toActionState(error: unknown): ActionState {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("SUPABASE_UPLOAD_FAILED")) {
    return { status: "error", message: "L'envoi du fichier a échoué." };
  }
  if (ERROR_MESSAGE[message]) {
    return { status: "error", message: ERROR_MESSAGE[message] };
  }
  // Prisma throws P2025 both for "record not found" and for a where clause
  // that includes a stale `version` -- either way this reads as a conflict.
  if (message.includes("P2025") || message.includes("No record")) {
    return {
      status: "error",
      message:
        "Cet élément a changé ou n'existe plus. Merci de recharger la page.",
    };
  }
  console.error("site-content action failed", error);
  return {
    status: "error",
    message: "L'action n'a pas pu être effectuée. Merci de réessayer.",
  };
}

export async function createPageAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const worldKey = text(formData, "worldKey");
  try {
    await actorFor(worldKey);
    const now = new Date();
    // A new page starts as DRAFT, so nothing public changes yet -- no
    // revalidation needed here (see transitionPageAction for publish).
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
    return { status: "success", message: "Page créée." };
  } catch (error) {
    return toActionState(error);
  }
}

export async function updatePageAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
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
    return { status: "success", message: "Page mise à jour." };
  } catch (error) {
    return toActionState(error);
  }
}

export async function transitionPageAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const id = text(formData, "id");
    const page = await prisma.page.findUniqueOrThrow({ where: { id } });
    const target = text(formData, "target") as
      "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";
    const isPublicChange = target === "PUBLISHED" || target === "ARCHIVED";
    const { actor, context } = await actorFor(page.worldKey, isPublicChange);
    if (target === "PUBLISHED") {
      const evidenceSections = await prisma.pageSection.findMany({
        where: {
          pageId: id,
          sectionType: { in: ["CASE_STUDY", "TESTIMONIAL"] },
        },
        select: { sectionType: true, payload: true },
      });
      const invalid = evidenceSections.some((section) => {
        if (!isEvidenceSectionType(section.sectionType)) return false;
        return (
          evidencePublicationErrors(
            section.sectionType,
            section.payload as Record<string, unknown>,
          ).length > 0
        );
      });
      if (invalid) throw new Error("EVIDENCE_NOT_PUBLISHABLE");
    }
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
    // Sections can only be edited while a page is DRAFT (see saveSectionAction),
    // so publish/archive here is the only moment the public rendering changes.
    if (isPublicChange) {
      revalidatePublicPage(page.worldKey, page.slug);
      await recordAuditEvent(prisma, {
        action:
          target === "PUBLISHED"
            ? "CONTENT_PAGE_PUBLISHED"
            : "CONTENT_PAGE_ARCHIVED",
        targetType: "PAGE",
        targetId: page.id,
        actorId: actor.id,
        correlationId: context.correlationId,
        originChannel: context.origin.channel,
        worldKey: page.worldKey,
        occurredAt: context.clock.now(),
      });
    }
    return { status: "success", message: "Statut de la page mis à jour." };
  } catch (error) {
    return toActionState(error);
  }
}

function parsePayload(raw: string): Record<string, unknown> {
  const value: unknown = JSON.parse(raw || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_SECTION_PAYLOAD");
  }
  return value as Record<string, unknown>;
}

export async function saveSectionAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const pageId = text(formData, "pageId");
    const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
    await actorFor(page.worldKey);
    if (page.lifecycle !== "DRAFT") throw new Error("PAGE_NOT_DRAFT");
    const id = text(formData, "id") || randomUUID();
    const now = new Date();
    const payload = parsePayload(text(formData, "payload"));
    const existingId = text(formData, "id");
    if (!existingId) {
      await prisma.pageSection.create({
        data: {
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
      });
    } else {
      const updated = await prisma.pageSection.updateMany({
        where: {
          id: existingId,
          version: Number(formData.get("expectedVersion")),
        },
        data: {
          sectionType: text(formData, "sectionType").toUpperCase(),
          order: Number(formData.get("order")),
          payload: payload as Prisma.InputJsonValue,
          version: { increment: 1 },
          updatedAt: now,
        },
      });
      if (updated.count === 0) throw new Error("EDIT_CONFLICT");
    }
    revalidatePath("/workspace/site-content");
    return { status: "success", message: "Section enregistrée." };
  } catch (error) {
    return toActionState(error);
  }
}

const TYPED_PAYLOAD_KEYS = [
  "eyebrow",
  "title",
  "text",
  "label",
  "href",
  "mediaId",
  "evidenceStatus",
  "evidenceClass",
  "claimOwner",
  "sourceLocation",
  "sourceOwner",
  "verificationDate",
  "attributionPermission",
  "mediaRights",
  "mediaCredit",
  "accessibleAlternative",
  "relatedService",
  "context",
  "scope",
  "evidence",
  "outcome",
  "outcomeTreatment",
  "limitations",
  "quote",
  "attribution",
] as const;

/**
 * Saves a section from named form fields instead of raw JSON. Unknown keys
 * already present in the payload are preserved so the advanced JSON editor
 * and this typed editor can coexist on the same section.
 */
export async function saveSectionFieldsAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const pageId = text(formData, "pageId");
    const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
    await actorFor(page.worldKey);
    if (page.lifecycle !== "DRAFT") throw new Error("PAGE_NOT_DRAFT");
    const id = text(formData, "id") || randomUUID();
    const existing = await prisma.pageSection.findUnique({ where: { id } });
    const payload: Record<string, unknown> = {
      ...((existing?.payload as Record<string, unknown> | null) ?? {}),
    };
    for (const key of TYPED_PAYLOAD_KEYS) {
      if (!formData.has(key)) continue;
      const value = text(formData, key);
      if (value) payload[key] = value;
      else delete payload[key];
    }
    const now = new Date();
    if (!existing) {
      await prisma.pageSection.create({
        data: {
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
      });
    } else {
      const updated = await prisma.pageSection.updateMany({
        where: {
          id,
          version: Number(formData.get("expectedVersion")),
        },
        data: {
          order: Number(formData.get("order")),
          payload: payload as Prisma.InputJsonValue,
          version: { increment: 1 },
          updatedAt: now,
        },
      });
      if (updated.count === 0) throw new Error("EDIT_CONFLICT");
    }
    revalidatePath("/workspace/site-content");
    return { status: "success", message: "Section enregistrée." };
  } catch (error) {
    return toActionState(error);
  }
}

export async function deleteSectionAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const id = text(formData, "id");
    const section = await prisma.pageSection.findUniqueOrThrow({
      where: { id },
      include: { page: true },
    });
    await actorFor(section.page.worldKey);
    if (section.page.lifecycle !== "DRAFT") throw new Error("PAGE_NOT_DRAFT");
    await prisma.pageSection.delete({ where: { id } });
    revalidatePath("/workspace/site-content");
    return { status: "success", message: "Section supprimée." };
  } catch (error) {
    return toActionState(error);
  }
}

export async function uploadMediaAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const worldKey = text(formData, "worldKey");
    await actorFor(worldKey);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("FILE_REQUIRED");
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      throw new Error("SUPABASE_STORAGE_NOT_CONFIGURED");
    }

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
    if (!response.ok) {
      throw new Error(`SUPABASE_UPLOAD_FAILED:${await response.text()}`);
    }

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
    return { status: "success", message: "Média envoyé." };
  } catch (error) {
    return toActionState(error);
  }
}

export async function deleteMediaAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
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
          headers: {
            authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
        },
      );
    }
    await prisma.mediaAsset.delete({ where: { id } });
    revalidatePath("/workspace/site-content");
    return { status: "success", message: "Média supprimé." };
  } catch (error) {
    return toActionState(error);
  }
}
