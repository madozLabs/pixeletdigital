"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/shared/prisma-client";
import { recordAuditEvent } from "@/modules/audit/infrastructure/record-audit-event";
import {
  evidencePublicationErrors,
  isEvidenceSectionType,
} from "@/modules/content/domain/evidence-section";
import {
  createDefaultBlockPayload,
  getPageBlockDefinition,
  isPageBlockType,
  validatePageBlock,
} from "@/modules/content/domain/page-block-registry";
import {
  isSectionImageSettingKey,
  normalizeSectionImageSetting,
  SECTION_IMAGE_SETTING_KEYS,
} from "@/modules/content/domain/section-image-settings";
import {
  defaultSiteIdentity,
  validateSiteIdentityConfig,
} from "@/modules/content/domain/site-identity";
import { validateWorkspaceMediaUpload } from "@/modules/content/application/workspace-site-content-policy";
import {
  movePageRevision,
  startPageDraft,
  updatePageDraftMetadata,
} from "@/modules/content/application/page-revision-use-cases";
import { PrismaPageRevisionRepository } from "@/modules/content/infrastructure/prisma-page-revision-repository";
import type { ActionState } from "../_components/feedback";
import { requireWorldAccess } from "../_lib/authorization";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import {
  deleteWorkspaceMediaFile,
  storeWorkspaceMediaFile,
} from "./media-storage";

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
  INVALID_PAGE_SLUG:
    "L’adresse de la page doit contenir uniquement des lettres minuscules, chiffres et tirets.",
  EVIDENCE_NOT_PUBLISHABLE:
    "Publication impossible : une preuve sociale est incomplète ou non approuvée.",
  BLOCK_NOT_PUBLISHABLE:
    "Publication impossible : un ou plusieurs blocs contiennent des champs requis manquants ou invalides.",
  SITE_IDENTITY_INVALID:
    "L’identité du site contient des champs incomplets ou invalides.",
  FILE_REQUIRED: "Merci de sélectionner un fichier.",
  FILE_TOO_LARGE: "Le fichier dépasse la taille maximale autorisée de 15 Mo.",
  FILE_TYPE_NOT_ALLOWED:
    "Type de fichier refusé. Utilisez une image JPEG, PNG, WebP ou un PDF.",
  INVALID_PAGE_TRANSITION:
    "Ce changement de statut n’est pas autorisé depuis l’état actuel de la page.",
  SECTION_PAGE_MISMATCH:
    "Cette section n’appartient pas à la page que vous êtes autorisé à modifier.",
  MEDIA_IN_USE:
    "Ce média est utilisé par une page et ne peut pas être supprimé.",
  MEDIA_NOT_FOUND:
    "Le média sélectionné n’existe pas dans cet univers ou n’est plus disponible.",
  STORAGE_DELETE_FAILED:
    "Le fichier n’a pas pu être supprimé du stockage. Aucune donnée n’a été retirée.",
  EDIT_CONFLICT:
    "Cet élément a été modifié par quelqu’un d’autre. Rechargez la page avant de réessayer.",
  NOTHING_TO_RESTORE: "Aucun bloc supprimé ne peut être restauré.",
  DRAFT_ALREADY_EXISTS:
    "Un brouillon existe déjà. Publiez-le ou abandonnez-le avant de restaurer une ancienne révision.",
  REVISION_NOT_RESTORABLE: "Cette révision ne peut pas être restaurée.",
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

function revisionDependencies() {
  return { revisions: new PrismaPageRevisionRepository(prisma) };
}

export async function startSiteIdentityDraftAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const worldKey = text(formData, "worldKey");
    const { actor } = await actorFor(worldKey);
    const now = new Date();
    await prisma.$transaction(async (transaction) => {
      const world = await transaction.world.findUniqueOrThrow({
        where: { key: worldKey },
      });
      let settings = await transaction.siteSettings.findUnique({
        where: { worldKey },
        include: { publishedRevision: true },
      });
      if (!settings) {
        settings = await transaction.siteSettings.create({
          data: { id: `site_settings_${worldKey}`, worldKey },
          include: { publishedRevision: true },
        });
      }
      if (settings.draftRevisionId) return;
      const aggregate = await transaction.siteSettingsRevision.aggregate({
        where: { settingsId: settings.id },
        _max: { revisionNumber: true },
      });
      const revision = await transaction.siteSettingsRevision.create({
        data: {
          id: `site_identity_revision_${randomUUID()}`,
          settingsId: settings.id,
          revisionNumber: (aggregate._max.revisionNumber ?? 0) + 1,
          status: "DRAFT",
          config:
            (settings.publishedRevision?.config as Prisma.InputJsonValue) ??
            (defaultSiteIdentity(
              worldKey,
              world.displayName,
            ) as unknown as Prisma.InputJsonValue),
          createdById: actor.id,
          createdAt: now,
          updatedAt: now,
        },
      });
      await transaction.siteSettings.update({
        where: { id: settings.id },
        data: { draftRevisionId: revision.id, updatedAt: now },
      });
    });
    revalidatePath("/workspace/site-content");
    return { status: "success", message: "Brouillon d’identité créé." };
  } catch (error) {
    return toActionState(error);
  }
}

export async function saveSiteIdentityDraftAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const worldKey = text(formData, "worldKey");
    await actorFor(worldKey);
    const revisionId = text(formData, "revisionId");
    const navigationItems = text(formData, "navigationItems")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [label, ...href] = line.split("|");
        return { label: label?.trim() ?? "", href: href.join("|").trim() };
      });
    const menusJson = text(formData, "menusJson");
    let menus: unknown = undefined;
    if (menusJson) {
      try {
        menus = JSON.parse(menusJson) as unknown;
      } catch {
        throw new Error("SITE_IDENTITY_INVALID");
      }
    }
    const parsed = validateSiteIdentityConfig({
      siteName: text(formData, "siteName"),
      tagline: text(formData, "tagline"),
      logoMediaId: text(formData, "logoMediaId"),
      faviconMediaId: text(formData, "faviconMediaId"),
      headingFont: text(formData, "headingFont"),
      bodyFont: text(formData, "bodyFont"),
      navigationItems,
      menus,
      primaryMenuId: text(formData, "primaryMenuId"),
      footerMenuId: text(formData, "footerMenuId"),
      footerText: text(formData, "footerText"),
      contactLabel: text(formData, "contactLabel"),
      contactHref: text(formData, "contactHref"),
      defaultSeoDescription: text(formData, "defaultSeoDescription"),
      contactEmail: text(formData, "contactEmail"),
      contactPhone: text(formData, "contactPhone"),
      whatsappNumber: text(formData, "whatsappNumber"),
      address: text(formData, "address"),
      linkedinHref: text(formData, "linkedinHref"),
      instagramHref: text(formData, "instagramHref"),
      legalNoticeHref: text(formData, "legalNoticeHref"),
      privacyPolicyHref: text(formData, "privacyPolicyHref"),
    });
    if (!parsed.ok) throw new Error("SITE_IDENTITY_INVALID");
    const mediaIds = [
      parsed.value.logoMediaId,
      parsed.value.faviconMediaId,
    ].filter(Boolean);
    const now = new Date();
    await prisma.$transaction(async (transaction) => {
      const settings = await transaction.siteSettings.findUniqueOrThrow({
        where: { worldKey },
      });
      if (settings.draftRevisionId !== revisionId)
        throw new Error("EDIT_CONFLICT");
      if (mediaIds.length > 0) {
        const count = await transaction.mediaAsset.count({
          where: {
            id: { in: mediaIds },
            worldKey,
            mimeType: { startsWith: "image/" },
          },
        });
        if (count !== new Set(mediaIds).size)
          throw new Error("MEDIA_NOT_FOUND");
      }
      const updated = await transaction.siteSettingsRevision.updateMany({
        where: {
          id: revisionId,
          settingsId: settings.id,
          status: "DRAFT",
          version: Number(formData.get("expectedVersion")),
        },
        data: {
          config: parsed.value as unknown as Prisma.InputJsonValue,
          version: { increment: 1 },
          updatedAt: now,
        },
      });
      if (updated.count !== 1) throw new Error("EDIT_CONFLICT");
      await transaction.siteIdentityMediaUsage.deleteMany({
        where: { revisionId },
      });
      const usages = [
        parsed.value.logoMediaId
          ? { mediaId: parsed.value.logoMediaId, slot: "logo" }
          : null,
        parsed.value.faviconMediaId
          ? { mediaId: parsed.value.faviconMediaId, slot: "favicon" }
          : null,
      ].filter(
        (usage): usage is { mediaId: string; slot: string } => usage !== null,
      );
      if (usages.length > 0) {
        await transaction.siteIdentityMediaUsage.createMany({
          data: usages.map((usage) => ({ ...usage, revisionId })),
        });
      }
      await transaction.siteSettings.update({
        where: { id: settings.id },
        data: { updatedAt: now },
      });
    });
    revalidatePath("/workspace/site-content");
    return { status: "success", message: "Identité enregistrée." };
  } catch (error) {
    return toActionState(error);
  }
}

export async function transitionSiteIdentityAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const worldKey = text(formData, "worldKey");
    const target = text(formData, "target");
    const review = target !== "IN_REVIEW";
    const { actor, context } = await actorFor(worldKey, review);
    const revisionId = text(formData, "revisionId");
    const current = await prisma.siteSettingsRevision.findUniqueOrThrow({
      where: { id: revisionId },
      include: { settings: true },
    });
    if (
      current.settings.worldKey !== worldKey ||
      current.settings.draftRevisionId !== current.id
    ) {
      throw new Error("EDIT_CONFLICT");
    }
    const allowed: Record<string, readonly string[]> = {
      DRAFT: ["IN_REVIEW"],
      IN_REVIEW: ["DRAFT", "APPROVED"],
      APPROVED: ["DRAFT", "PUBLISHED"],
    };
    if (!allowed[current.status]?.includes(target)) {
      throw new Error("INVALID_PAGE_TRANSITION");
    }
    const now = new Date();
    await prisma.$transaction(async (transaction) => {
      const updated = await transaction.siteSettingsRevision.updateMany({
        where: {
          id: revisionId,
          status: current.status,
          version: Number(formData.get("expectedVersion")),
        },
        data: {
          status: target as "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED",
          version: { increment: 1 },
          reviewedById: target === "APPROVED" ? actor.id : current.reviewedById,
          reviewedAt: target === "APPROVED" ? now : current.reviewedAt,
          publishedById:
            target === "PUBLISHED" ? actor.id : current.publishedById,
          publishedAt: target === "PUBLISHED" ? now : current.publishedAt,
          updatedAt: now,
        },
      });
      if (updated.count !== 1) throw new Error("EDIT_CONFLICT");
      if (target === "PUBLISHED") {
        if (current.settings.publishedRevisionId) {
          await transaction.siteSettingsRevision.updateMany({
            where: {
              id: current.settings.publishedRevisionId,
              status: "PUBLISHED",
            },
            data: {
              status: "SUPERSEDED",
              version: { increment: 1 },
              updatedAt: now,
            },
          });
        }
        await transaction.siteSettings.update({
          where: { id: current.settings.id },
          data: {
            publishedRevisionId: revisionId,
            draftRevisionId: null,
            updatedAt: now,
          },
        });
      }
    });
    revalidatePath("/workspace/site-content");
    if (target === "PUBLISHED") {
      revalidatePath(
        worldKey === "kwaliti-print" ? "/kwaliti-print" : "/",
        "layout",
      );
      await recordAuditEvent(prisma, {
        action: "CONTENT_SITE_IDENTITY_PUBLISHED",
        targetType: "SITE_SETTINGS",
        targetId: current.settings.id,
        actorId: actor.id,
        correlationId: context.correlationId,
        originChannel: context.origin.channel,
        worldKey,
        occurredAt: now,
      });
    }
    return { status: "success", message: "Identité du site mise à jour." };
  } catch (error) {
    return toActionState(error);
  }
}

function resultState<T>(
  result:
    | { ok: true; value: T }
    | { ok: false; error: { code: string; message: string } },
  success: string,
): ActionState {
  return result.ok
    ? { status: "success", message: success }
    : { status: "error", message: result.error.message };
}

export async function startPageRevisionAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return toActionState(new Error("UNAUTHORIZED"));
  const result = await startPageDraft(revisionDependencies(), context, {
    pageId: text(formData, "pageId"),
  });
  if (result.ok) revalidatePath("/workspace/site-content");
  return resultState(result, "Brouillon de travail créé.");
}

export async function updatePageRevisionMetadataAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return toActionState(new Error("UNAUTHORIZED"));
  const result = await updatePageDraftMetadata(
    revisionDependencies(),
    context,
    {
      pageId: text(formData, "pageId"),
      revisionId: text(formData, "revisionId"),
      expectedVersion: Number(formData.get("expectedVersion")),
      title: text(formData, "title"),
      seoTitle: text(formData, "seoTitle"),
      seoDescription: text(formData, "seoDescription"),
    },
  );
  if (result.ok) revalidatePath("/workspace/site-content");
  return resultState(result, "Brouillon enregistré.");
}

export async function transitionPageRevisionAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return toActionState(new Error("UNAUTHORIZED"));
  const pageId = text(formData, "pageId");
  const target = text(formData, "target");
  if (
    ![
      "DRAFT",
      "IN_REVIEW",
      "APPROVED",
      "PUBLISHED",
      "SUPERSEDED",
      "ARCHIVED",
    ].includes(target)
  ) {
    return toActionState(new Error("INVALID_PAGE_TRANSITION"));
  }
  if (target === "PUBLISHED") {
    const candidateSections = await prisma.pageRevisionSection.findMany({
      where: {
        revisionId: text(formData, "revisionId"),
      },
      select: { sectionType: true, payload: true },
    });
    const invalidBlock = candidateSections.some(
      (section) =>
        validatePageBlock(
          section.sectionType,
          section.payload as Record<string, unknown>,
        ).length > 0,
    );
    const invalidEvidence = candidateSections.some(
      (section) =>
        isEvidenceSectionType(section.sectionType) &&
        evidencePublicationErrors(
          section.sectionType,
          section.payload as Record<string, unknown>,
        ).length > 0,
    );
    if (invalidEvidence) {
      return toActionState(new Error("EVIDENCE_NOT_PUBLISHABLE"));
    }
    if (invalidBlock) return toActionState(new Error("BLOCK_NOT_PUBLISHABLE"));
  }
  const result = await movePageRevision(revisionDependencies(), context, {
    pageId,
    revisionId: text(formData, "revisionId"),
    expectedVersion: Number(formData.get("expectedVersion")),
    target: target as Parameters<typeof movePageRevision>[2]["target"],
  });
  if (result.ok) {
    revalidatePath("/workspace/site-content");
    if (result.value.status === "PUBLISHED") {
      const page = await prisma.page.findUnique({
        where: { id: pageId },
        select: { worldKey: true, slug: true },
      });
      if (page) revalidatePublicPage(page.worldKey, page.slug);
    }
  }
  return resultState(result, "Étape de publication mise à jour.");
}

export async function restorePageRevisionAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return toActionState(new Error("UNAUTHORIZED"));
  try {
    const pageId = text(formData, "pageId");
    const sourceRevisionId = text(formData, "sourceRevisionId");
    const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
    const { actor } = await actorFor(page.worldKey);
    if (page.draftRevisionId) throw new Error("DRAFT_ALREADY_EXISTS");
    await prisma.$transaction(async (transaction) => {
      const source = await transaction.pageRevision.findFirst({
        where: {
          id: sourceRevisionId,
          pageId,
          status: { in: ["PUBLISHED", "SUPERSEDED", "ARCHIVED"] },
        },
        include: {
          sections: {
            orderBy: { order: "asc" },
            include: { mediaUsages: { orderBy: { order: "asc" } } },
          },
        },
      });
      if (!source) throw new Error("REVISION_NOT_RESTORABLE");
      const aggregate = await transaction.pageRevision.aggregate({
        where: { pageId },
        _max: { revisionNumber: true },
      });
      const now = context.clock.now();
      const restored = await transaction.pageRevision.create({
        data: {
          id: `revision_${randomUUID()}`,
          pageId,
          revisionNumber: (aggregate._max.revisionNumber ?? 0) + 1,
          status: "DRAFT",
          title: source.title,
          seoTitle: source.seoTitle,
          seoDescription: source.seoDescription,
          version: 1,
          createdById: actor.id,
          createdAt: now,
          updatedAt: now,
          sections: {
            create: source.sections.map((section) => ({
              id: `revision_section_${randomUUID()}`,
              sectionKey: section.sectionKey,
              sectionType: section.sectionType,
              order: section.order,
              payload: section.payload as Prisma.InputJsonValue,
              payloadSchemaVersion: section.payloadSchemaVersion,
              version: 1,
              createdAt: now,
              updatedAt: now,
              mediaUsages: {
                create: section.mediaUsages.map((usage) => ({
                  mediaId: usage.mediaId,
                  slot: usage.slot,
                  order: usage.order,
                  createdAt: now,
                })),
              },
            })),
          },
        },
      });
      await transaction.page.update({
        where: { id: pageId },
        data: { draftRevisionId: restored.id, updatedAt: now },
      });
    });
    revalidatePath("/workspace/site-content");
    return {
      status: "success",
      message: "Révision restaurée dans un nouveau brouillon.",
    };
  } catch (error) {
    return toActionState(error);
  }
}

export async function createPageAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const worldKey = text(formData, "worldKey");
  let createdPageId: string | null = null;
  try {
    const { actor } = await actorFor(worldKey);
    const now = new Date();
    const slug = text(formData, "slug");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error("INVALID_PAGE_SLUG");
    }
    // A new page starts as DRAFT, so nothing public changes yet -- no
    // A new draft does not change the published revision.
    await prisma.$transaction(async (transaction) => {
      const pageId = randomUUID();
      createdPageId = pageId;
      const revisionId = `revision_${randomUUID()}`;
      await transaction.page.create({
        data: {
          id: pageId,
          worldKey,
          pageType: text(formData, "pageType") || "LANDING",
          title: text(formData, "title"),
          slug,
          routePath:
            slug === "accueil"
              ? worldKey === "kwaliti-print"
                ? "/kwaliti-print"
                : "/"
              : worldKey === "kwaliti-print"
                ? `/kwaliti-print/${slug}`
                : `/${slug}`,
          lifecycle: "DRAFT",
          version: 1,
          createdAt: now,
          updatedAt: now,
        },
      });
      await transaction.pageRevision.create({
        data: {
          id: revisionId,
          pageId,
          revisionNumber: 1,
          status: "DRAFT",
          title: text(formData, "title"),
          createdById: actor.id,
          createdAt: now,
          updatedAt: now,
        },
      });
      await transaction.page.update({
        where: { id: pageId },
        data: { draftRevisionId: revisionId },
      });
    });
    revalidatePath("/workspace/site-content");
  } catch (error) {
    return toActionState(error);
  }
  redirect(
    `/workspace/site-content/pages/${encodeURIComponent(createdPageId ?? "")}/edit?world=${encodeURIComponent(worldKey)}`,
  );
}

function parsePayload(raw: string): Record<string, unknown> {
  const value: unknown = JSON.parse(raw || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_SECTION_PAYLOAD");
  }
  return value as Record<string, unknown>;
}

async function assertEditableRevision(pageId: string, revisionId: string) {
  const revision = await prisma.pageRevision.findFirst({
    where: { id: revisionId, pageId, status: "DRAFT" },
    select: { id: true, page: { select: { draftRevisionId: true } } },
  });
  if (!revision || revision.page.draftRevisionId !== revision.id) {
    throw new Error("PAGE_NOT_DRAFT");
  }
}

async function saveRevisionSection(input: {
  id: string | null;
  pageId: string;
  revisionId: string;
  expectedVersion: number;
  sectionType: string;
  order: number;
  payload: Record<string, unknown>;
  now: Date;
  shiftAtOrder?: number;
}) {
  await prisma.$transaction(async (transaction) => {
    const revision = await transaction.pageRevision.findFirst({
      where: { id: input.revisionId, pageId: input.pageId, status: "DRAFT" },
      select: { page: { select: { draftRevisionId: true, worldKey: true } } },
    });
    if (revision?.page.draftRevisionId !== input.revisionId) {
      throw new Error("PAGE_NOT_DRAFT");
    }
    const primaryMediaId =
      typeof input.payload.mediaId === "string" && input.payload.mediaId
        ? input.payload.mediaId
        : null;
    const backgroundMediaId =
      typeof input.payload.backgroundMediaId === "string" &&
      input.payload.backgroundMediaId
        ? input.payload.backgroundMediaId
        : null;
    const galleryMediaIds = Array.isArray(input.payload.mediaIds)
      ? input.payload.mediaIds.filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        )
      : [];
    const mediaIds = [
      ...new Set([
        ...(primaryMediaId ? [primaryMediaId] : []),
        ...(backgroundMediaId ? [backgroundMediaId] : []),
        ...galleryMediaIds,
      ]),
    ];
    const mediaUsages = [
      ...(primaryMediaId
        ? [{ mediaId: primaryMediaId, slot: "primary", order: 0 }]
        : []),
      ...(backgroundMediaId
        ? [{ mediaId: backgroundMediaId, slot: "background", order: 0 }]
        : []),
      ...galleryMediaIds.map((mediaId, order) => ({
        mediaId,
        slot: "gallery",
        order,
      })),
    ];
    if (mediaIds.length > 0) {
      const mediaCount = await transaction.mediaAsset.count({
        where: { id: { in: mediaIds }, worldKey: revision.page.worldKey },
      });
      if (mediaCount !== mediaIds.length) throw new Error("MEDIA_NOT_FOUND");
    }

    let sectionId = input.id;
    if (sectionId) {
      const updated = await transaction.pageRevisionSection.updateMany({
        where: {
          id: sectionId,
          revisionId: input.revisionId,
          version: input.expectedVersion,
        },
        data: {
          sectionType: input.sectionType,
          order: input.order,
          payload: input.payload as Prisma.InputJsonValue,
          version: { increment: 1 },
          updatedAt: input.now,
        },
      });
      if (updated.count !== 1) throw new Error("EDIT_CONFLICT");
    } else {
      if (input.shiftAtOrder !== undefined) {
        await transaction.pageRevisionSection.updateMany({
          where: {
            revisionId: input.revisionId,
            order: { gte: input.shiftAtOrder },
          },
          data: { order: { increment: 1 }, updatedAt: input.now },
        });
      }
      sectionId = `revision_section_${randomUUID()}`;
      await transaction.pageRevisionSection.create({
        data: {
          id: sectionId,
          revisionId: input.revisionId,
          sectionKey: `section_${randomUUID()}`,
          sectionType: input.sectionType,
          order: input.order,
          payload: input.payload as Prisma.InputJsonValue,
          payloadSchemaVersion: 1,
          version: 1,
          createdAt: input.now,
          updatedAt: input.now,
        },
      });
    }
    await transaction.sectionMediaUsage.deleteMany({
      where: { sectionId },
    });
    if (mediaUsages.length > 0) {
      await transaction.sectionMediaUsage.createMany({
        data: mediaUsages.map((usage) => ({ sectionId, ...usage })),
      });
    }
    await transaction.pageRevision.update({
      where: { id: input.revisionId },
      data: { version: { increment: 1 }, updatedAt: input.now },
    });
    await transaction.page.update({
      where: { id: input.pageId },
      data: { updatedAt: input.now },
    });
  });
}

export async function addPageBlockAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const pageId = text(formData, "pageId");
    const revisionId = text(formData, "revisionId");
    const sectionType = text(formData, "sectionType");
    if (!isPageBlockType(sectionType))
      throw new Error("INVALID_SECTION_PAYLOAD");
    const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
    await actorFor(page.worldKey);
    await assertEditableRevision(pageId, revisionId);
    const beforeSectionId = text(formData, "beforeSectionId");
    const beforeSection = beforeSectionId
      ? await prisma.pageRevisionSection.findFirst({
          where: { id: beforeSectionId, revisionId },
          select: { order: true },
        })
      : null;
    const aggregate = beforeSection
      ? null
      : await prisma.pageRevisionSection.aggregate({
          where: { revisionId },
          _max: { order: true },
        });
    const order = beforeSection?.order ?? (aggregate?._max.order ?? -1) + 1;
    await saveRevisionSection({
      id: null,
      pageId,
      revisionId,
      expectedVersion: 0,
      sectionType,
      order,
      payload: createDefaultBlockPayload(sectionType) as Record<
        string,
        unknown
      >,
      now: new Date(),
      shiftAtOrder: beforeSection?.order,
    });
    revalidatePath("/workspace/site-content");
    return { status: "success", message: "Bloc ajouté à la page." };
  } catch (error) {
    return toActionState(error);
  }
}

export async function duplicatePageBlockAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const pageId = text(formData, "pageId");
    const revisionId = text(formData, "revisionId");
    const sectionId = text(formData, "sectionId");
    const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
    await actorFor(page.worldKey);
    await assertEditableRevision(pageId, revisionId);
    const source = await prisma.pageRevisionSection.findFirst({
      where: { id: sectionId, revisionId },
      include: { mediaUsages: true },
    });
    if (!source) throw new Error("SECTION_PAGE_MISMATCH");
    const now = new Date();
    await prisma.$transaction(async (transaction) => {
      await transaction.pageRevisionSection.updateMany({
        where: { revisionId, order: { gt: source.order } },
        data: { order: { increment: 1 } },
      });
      const duplicateId = `revision_section_${randomUUID()}`;
      await transaction.pageRevisionSection.create({
        data: {
          id: duplicateId,
          revisionId,
          sectionKey: `section_${randomUUID()}`,
          sectionType: source.sectionType,
          order: source.order + 1,
          payload: source.payload as Prisma.InputJsonValue,
          payloadSchemaVersion: source.payloadSchemaVersion,
          version: 1,
          createdAt: now,
          updatedAt: now,
          mediaUsages: {
            create: source.mediaUsages.map((usage) => ({
              mediaId: usage.mediaId,
              slot: usage.slot,
              order: usage.order,
              createdAt: now,
            })),
          },
        },
      });
      await transaction.pageRevision.update({
        where: { id: revisionId },
        data: { version: { increment: 1 }, updatedAt: now },
      });
      await transaction.page.update({
        where: { id: pageId },
        data: { updatedAt: now },
      });
    });
    revalidatePath("/workspace/site-content");
    return { status: "success", message: "Bloc dupliqué." };
  } catch (error) {
    return toActionState(error);
  }
}

export async function copyPageBlockToPageAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const sourcePageId = text(formData, "pageId");
    const sourceRevisionId = text(formData, "revisionId");
    const sectionId = text(formData, "sectionId");
    const targetPageId = text(formData, "targetPageId");
    const sourcePage = await prisma.page.findUniqueOrThrow({
      where: { id: sourcePageId },
    });
    const targetPage = await prisma.page.findUniqueOrThrow({
      where: { id: targetPageId },
    });
    await actorFor(sourcePage.worldKey);
    if (targetPage.worldKey !== sourcePage.worldKey)
      throw new Error("FORBIDDEN_WORLD_SCOPE");
    if (!targetPage.draftRevisionId) throw new Error("PAGE_NOT_DRAFT");
    await assertEditableRevision(sourcePageId, sourceRevisionId);
    await assertEditableRevision(targetPageId, targetPage.draftRevisionId);
    const source = await prisma.pageRevisionSection.findFirst({
      where: { id: sectionId, revisionId: sourceRevisionId },
      include: { mediaUsages: true },
    });
    if (!source) throw new Error("SECTION_PAGE_MISMATCH");
    const aggregate = await prisma.pageRevisionSection.aggregate({
      where: { revisionId: targetPage.draftRevisionId },
      _max: { order: true },
    });
    const now = new Date();
    await prisma.$transaction(async (transaction) => {
      await transaction.pageRevisionSection.create({
        data: {
          id: `revision_section_${randomUUID()}`,
          revisionId: targetPage.draftRevisionId!,
          sectionKey: `section_${randomUUID()}`,
          sectionType: source.sectionType,
          order: (aggregate._max.order ?? -1) + 1,
          payload: source.payload as Prisma.InputJsonValue,
          payloadSchemaVersion: source.payloadSchemaVersion,
          version: 1,
          createdAt: now,
          updatedAt: now,
          mediaUsages: {
            create: source.mediaUsages.map((usage) => ({
              mediaId: usage.mediaId,
              slot: usage.slot,
              order: usage.order,
              createdAt: now,
            })),
          },
        },
      });
      await transaction.pageRevision.update({
        where: { id: targetPage.draftRevisionId! },
        data: { version: { increment: 1 }, updatedAt: now },
      });
      await transaction.page.update({
        where: { id: targetPageId },
        data: { updatedAt: now },
      });
    });
    revalidatePath("/workspace/site-content");
    return { status: "success", message: "Bloc copié vers l’autre page." };
  } catch (error) {
    return toActionState(error);
  }
}

export async function reorderPageBlocksAction(
  formData: FormData,
): Promise<ActionState> {
  try {
    const pageId = text(formData, "pageId");
    const revisionId = text(formData, "revisionId");
    const expectedVersion = Number(formData.get("expectedVersion"));
    const orderedIds = JSON.parse(text(formData, "orderedIds")) as unknown;
    if (
      !Array.isArray(orderedIds) ||
      orderedIds.some((id) => typeof id !== "string") ||
      new Set(orderedIds).size !== orderedIds.length
    ) {
      throw new Error("INVALID_SECTION_PAYLOAD");
    }
    const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
    await actorFor(page.worldKey);
    await assertEditableRevision(pageId, revisionId);
    const persisted = await prisma.pageRevisionSection.findMany({
      where: { revisionId },
      select: { id: true },
    });
    if (
      persisted.length !== orderedIds.length ||
      persisted.some((section) => !orderedIds.includes(section.id))
    ) {
      throw new Error("EDIT_CONFLICT");
    }
    const now = new Date();
    await prisma.$transaction(async (transaction) => {
      const revision = await transaction.pageRevision.updateMany({
        where: {
          id: revisionId,
          pageId,
          status: "DRAFT",
          version: expectedVersion,
        },
        data: { version: { increment: 1 }, updatedAt: now },
      });
      if (revision.count !== 1) throw new Error("EDIT_CONFLICT");
      await Promise.all(
        orderedIds.map((id, order) =>
          transaction.pageRevisionSection.update({
            where: { id },
            data: { order, updatedAt: now },
          }),
        ),
      );
      await transaction.page.update({
        where: { id: pageId },
        data: { updatedAt: now },
      });
    });
    revalidatePath("/workspace/site-content");
    return { status: "success", message: "Ordre des blocs enregistré." };
  } catch (error) {
    return toActionState(error);
  }
}

/** Updates the primary visual of a block from the visual page editor. */
export async function setPageBlockMediaAction(
  formData: FormData,
): Promise<ActionState> {
  try {
    const pageId = text(formData, "pageId");
    const revisionId = text(formData, "revisionId");
    const sectionId = text(formData, "sectionId");
    const mediaId = text(formData, "mediaId");
    const slot = text(formData, "slot") || "primary";
    const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
    await actorFor(page.worldKey);
    await assertEditableRevision(pageId, revisionId);
    const section = await prisma.pageRevisionSection.findFirst({
      where: { id: sectionId, revisionId },
    });
    if (!section) throw new Error("SECTION_PAGE_MISMATCH");
    const definition = getPageBlockDefinition(section.sectionType);
    const supportsPrimary = definition?.fields.some(
      (field) => field.kind === "MEDIA",
    );
    const supportsGallery = definition?.fields.some(
      (field) => field.key === "mediaIds",
    );
    if (
      (slot === "primary" && !supportsPrimary) ||
      (slot === "gallery" && !supportsGallery) ||
      (slot !== "primary" && slot !== "gallery")
    ) {
      throw new Error("INVALID_SECTION_PAYLOAD");
    }
    const payload = {
      ...(section.payload as Record<string, unknown>),
    };
    if (slot === "gallery") {
      const mediaIds = JSON.parse(
        text(formData, "mediaIds") || "[]",
      ) as unknown;
      if (
        !Array.isArray(mediaIds) ||
        mediaIds.some((id) => typeof id !== "string") ||
        new Set(mediaIds).size !== mediaIds.length
      ) {
        throw new Error("INVALID_SECTION_PAYLOAD");
      }
      payload.mediaIds = mediaIds;
    } else if (mediaId) payload.mediaId = mediaId;
    else delete payload.mediaId;
    await saveRevisionSection({
      id: section.id,
      pageId,
      revisionId,
      expectedVersion: Number(formData.get("expectedVersion")),
      sectionType: section.sectionType,
      order: section.order,
      payload,
      now: new Date(),
    });
    revalidatePath("/workspace/site-content");
    return {
      status: "success",
      message:
        slot === "gallery"
          ? "Images du bloc mises à jour."
          : mediaId
            ? "Image du bloc mise à jour."
            : "Image retirée du bloc.",
    };
  } catch (error) {
    return toActionState(error);
  }
}

export async function saveSectionAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const pageId = text(formData, "pageId");
    const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
    await actorFor(page.worldKey);
    const revisionId = text(formData, "revisionId");
    if (!revisionId) throw new Error("PAGE_NOT_DRAFT");
    await assertEditableRevision(page.id, revisionId);
    const payload = parsePayload(text(formData, "payload"));
    await saveRevisionSection({
      id: text(formData, "id") || null,
      pageId,
      revisionId,
      expectedVersion: Number(formData.get("expectedVersion")),
      sectionType: text(formData, "sectionType").toUpperCase(),
      order: Number(formData.get("order")),
      payload,
      now: new Date(),
    });
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
  "backgroundMediaId",
  "backgroundOverlay",
  "backgroundPosition",
  "textTone",
  "surfaceTone",
  "contentWidth",
  "sectionDensity",
  "headingFont",
  "headingWeight",
  "headingStyle",
  "bodyFont",
  "bodyWeight",
  "bodyStyle",
  ...SECTION_IMAGE_SETTING_KEYS,
  "formKey",
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

function applyTypedPayloadFields(
  payload: Record<string, unknown>,
  formData: FormData,
) {
  for (const key of TYPED_PAYLOAD_KEYS) {
    if (!formData.has(key)) continue;
    const value = text(formData, key);
    if (isSectionImageSettingKey(key)) {
      const normalized = normalizeSectionImageSetting(key, value);
      if (normalized === null) throw new Error("INVALID_SECTION_PAYLOAD");
      payload[key] = normalized;
      continue;
    }
    if (value) payload[key] = value;
    else delete payload[key];
  }
}

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
    const revisionId = text(formData, "revisionId");
    if (!revisionId) throw new Error("PAGE_NOT_DRAFT");
    await assertEditableRevision(page.id, revisionId);
    const id = text(formData, "id");
    const existing = await prisma.pageRevisionSection.findFirst({
      where: { id, revisionId },
    });
    if (!existing) throw new Error("SECTION_PAGE_MISMATCH");
    const payload: Record<string, unknown> = {
      ...(existing.payload as Record<string, unknown>),
    };
    applyTypedPayloadFields(payload, formData);
    if (formData.has("hasMediaIds")) {
      payload.mediaIds = formData
        .getAll("mediaIds")
        .map(String)
        .filter(Boolean);
    }
    if (formData.has("itemsText")) {
      payload.items = text(formData, "itemsText")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [title, ...rest] = line.split("|");
          return { title: title?.trim() ?? "", text: rest.join("|").trim() };
        });
    }
    await saveRevisionSection({
      id,
      pageId,
      revisionId,
      expectedVersion: Number(formData.get("expectedVersion")),
      sectionType: existing.sectionType,
      order: Number(formData.get("order")),
      payload,
      now: new Date(),
    });
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
    const revisionId = text(formData, "revisionId");
    const pageId = text(formData, "pageId");
    if (!revisionId || !pageId) throw new Error("PAGE_NOT_DRAFT");
    const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
    const { actor } = await actorFor(page.worldKey);
    await assertEditableRevision(pageId, revisionId);
    await prisma.$transaction(async (transaction) => {
      const section = await transaction.pageRevisionSection.findFirst({
        where: { id, revisionId },
        include: { mediaUsages: { orderBy: { order: "asc" } } },
      });
      if (!section) throw new Error("SECTION_PAGE_MISMATCH");
      await transaction.pageBlockDeletion.create({
        data: {
          pageId,
          revisionId,
          sectionType: section.sectionType,
          order: section.order,
          payload: section.payload as Prisma.InputJsonValue,
          payloadSchemaVersion: section.payloadSchemaVersion,
          mediaUsages: section.mediaUsages.map((usage) => ({
            mediaId: usage.mediaId,
            slot: usage.slot,
            order: usage.order,
          })) as Prisma.InputJsonValue,
          deletedById: actor.id,
        },
      });
      await transaction.sectionMediaUsage.deleteMany({
        where: { sectionId: id, section: { revisionId } },
      });
      const deleted = await transaction.pageRevisionSection.deleteMany({
        where: { id, revisionId },
      });
      if (deleted.count !== 1) throw new Error("SECTION_PAGE_MISMATCH");
      const now = new Date();
      await transaction.pageRevision.update({
        where: { id: revisionId },
        data: { version: { increment: 1 }, updatedAt: now },
      });
      await transaction.page.update({
        where: { id: pageId },
        data: { updatedAt: now },
      });
    });
    revalidatePath("/workspace/site-content");
    return { status: "success", message: "Section supprimée." };
  } catch (error) {
    return toActionState(error);
  }
}

export async function restoreLastDeletedBlockAction(
  formData: FormData,
): Promise<ActionState> {
  try {
    const pageId = text(formData, "pageId");
    const revisionId = text(formData, "revisionId");
    const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
    await actorFor(page.worldKey);
    await assertEditableRevision(pageId, revisionId);
    await prisma.$transaction(async (transaction) => {
      const deletion = await transaction.pageBlockDeletion.findFirst({
        where: { pageId, revisionId, restoredAt: null },
        orderBy: { createdAt: "desc" },
      });
      if (!deletion) throw new Error("NOTHING_TO_RESTORE");
      const mediaUsages = Array.isArray(deletion.mediaUsages)
        ? deletion.mediaUsages.flatMap((usage) => {
            if (!usage || typeof usage !== "object" || Array.isArray(usage))
              return [];
            const record = usage as Record<string, unknown>;
            return typeof record.mediaId === "string" &&
              typeof record.slot === "string" &&
              typeof record.order === "number"
              ? [
                  {
                    mediaId: record.mediaId,
                    slot: record.slot,
                    order: record.order,
                  },
                ]
              : [];
          })
        : [];
      const availableMedia = mediaUsages.length
        ? await transaction.mediaAsset.findMany({
            where: {
              id: { in: mediaUsages.map((usage) => usage.mediaId) },
              worldKey: page.worldKey,
            },
            select: { id: true },
          })
        : [];
      const availableIds = new Set(availableMedia.map((asset) => asset.id));
      await transaction.pageRevisionSection.updateMany({
        where: { revisionId, order: { gte: deletion.order } },
        data: { order: { increment: 1 } },
      });
      const sectionId = `revision_section_${randomUUID()}`;
      await transaction.pageRevisionSection.create({
        data: {
          id: sectionId,
          revisionId,
          sectionKey: `section_${randomUUID()}`,
          sectionType: deletion.sectionType,
          order: deletion.order,
          payload: deletion.payload as Prisma.InputJsonValue,
          payloadSchemaVersion: deletion.payloadSchemaVersion,
          version: 1,
          mediaUsages: {
            create: mediaUsages
              .filter((usage) => availableIds.has(usage.mediaId))
              .map((usage) => ({ ...usage })),
          },
        },
      });
      const now = new Date();
      await transaction.pageBlockDeletion.update({
        where: { id: deletion.id },
        data: { restoredAt: now },
      });
      await transaction.pageRevision.update({
        where: { id: revisionId },
        data: { version: { increment: 1 }, updatedAt: now },
      });
      await transaction.page.update({
        where: { id: pageId },
        data: { updatedAt: now },
      });
    });
    revalidatePath("/workspace/site-content");
    return { status: "success", message: "Dernier bloc supprimé restauré." };
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
    const uploadError = validateWorkspaceMediaUpload({
      size: file.size,
      mimeType: file.type,
    });
    if (uploadError) throw new Error(uploadError);

    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
    const objectPath = `${worldKey}/${new Date().getUTCFullYear()}/${randomUUID()}-${safeName}`;
    const storage = await storeWorkspaceMediaFile(file, objectPath);

    await prisma.mediaAsset.create({
      data: {
        worldKey,
        bucket: storage.bucket,
        objectPath,
        publicUrl: storage.publicUrl,
        title: text(formData, "title") || file.name,
        altText: text(formData, "altText"),
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        width: optionalMediaDimension(formData.get("width")),
        height: optionalMediaDimension(formData.get("height")),
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

function optionalMediaDimension(value: FormDataEntryValue | null) {
  const dimension = Number(value);
  return Number.isInteger(dimension) && dimension > 0 && dimension <= 100_000
    ? dimension
    : null;
}

export async function deleteMediaAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const id = text(formData, "id");
    const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id } });
    await actorFor(asset.worldKey);
    const revisionUsageCount = await prisma.sectionMediaUsage.count({
      where: { mediaId: asset.id },
    });
    const identityUsageCount = await prisma.siteIdentityMediaUsage.count({
      where: { mediaId: asset.id },
    });
    if (revisionUsageCount > 0 || identityUsageCount > 0) {
      throw new Error("MEDIA_IN_USE");
    }
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (asset.bucket === "local-development") {
      await deleteWorkspaceMediaFile(asset.objectPath);
    } else if (supabaseUrl && serviceKey) {
      const response = await fetch(
        `${supabaseUrl}/storage/v1/object/${asset.bucket}/${asset.objectPath}`,
        {
          method: "DELETE",
          headers: {
            authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
        },
      );
      if (!response.ok && response.status !== 404) {
        throw new Error("STORAGE_DELETE_FAILED");
      }
    }
    await prisma.mediaAsset.delete({ where: { id } });
    revalidatePath("/workspace/site-content");
    return { status: "success", message: "Média supprimé." };
  } catch (error) {
    return toActionState(error);
  }
}
