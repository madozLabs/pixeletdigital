"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { AccessRole, Prisma } from "@/generated/prisma/client";
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
  parseColumnsPayload,
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

// Lower number = more privileged. Used to answer "is this actor at least as
// privileged as the role a section is restricted to" for per-block edit
// permissions (see assertSectionEditAllowed) -- separate from EDIT_ROLES/
// PUBLISH_ROLES above, which gate whole actions rather than one block.
const ROLE_RANK: Readonly<Record<string, number>> = {
  SUPER_ADMIN: 0,
  ADMIN: 1,
  WORLD_MANAGER: 2,
  EDITOR: 3,
  SALES: 4,
  CONTRIBUTOR: 5,
  READER: 6,
};

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
  NOTHING_TO_UNDO: "Rien à annuler.",
  NOTHING_TO_REDO: "Rien à rétablir.",
  DRAFT_ALREADY_EXISTS:
    "Un brouillon existe déjà. Publiez-le ou abandonnez-le avant de restaurer une ancienne révision.",
  REVISION_NOT_RESTORABLE: "Cette révision ne peut pas être restaurée.",
  SUPABASE_STORAGE_NOT_CONFIGURED:
    "Le stockage média n'est pas configuré sur cet environnement.",
  PAGE_NOT_FOUND: "Cette page n'existe plus.",
  PAGE_NOT_DUPLICABLE:
    "Les pages système ou liées à un service ne peuvent pas être dupliquées.",
  SELF_APPROVAL_BLOCKED:
    "Vous ne pouvez pas approuver une révision que vous avez vous-même soumise : demandez à un autre approbateur.",
  INVALID_SCHEDULE_DATE:
    "La date de publication programmée doit être dans le futur.",
  COMPONENT_NAME_REQUIRED: "Merci de donner un nom au composant.",
  COMPONENT_NAME_TAKEN: "Un composant porte déjà ce nom dans cet univers.",
  COMPONENT_NOT_FOUND: "Ce composant global n'existe plus.",
  COMPONENT_IN_USE:
    "Ce composant est utilisé par au moins une page. Détachez d'abord chaque bloc qui l'utilise avant de le supprimer.",
  SECTION_NOT_A_COMPONENT_INSTANCE:
    "Ce bloc n'est pas lié à un composant global.",
  TEMPLATE_NAME_REQUIRED: "Merci de donner un nom au gabarit.",
  TEMPLATE_NAME_TAKEN: "Un gabarit porte déjà ce nom dans cet univers.",
  TEMPLATE_EMPTY: "Cette page n'a aucun bloc à enregistrer comme gabarit.",
  SECTION_RESTRICTED:
    "Ce bloc est réservé à un rôle plus élevé que le vôtre.",
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
      invoiceStampMediaId: text(formData, "invoiceStampMediaId"),
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
      parsed.value.invoiceStampMediaId,
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
        parsed.value.invoiceStampMediaId
          ? { mediaId: parsed.value.invoiceStampMediaId, slot: "invoiceStamp" }
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
      ogImageMediaId: text(formData, "ogImageMediaId"),
    },
  );
  if (result.ok) revalidatePath("/workspace/site-content");
  return resultState(result, "Brouillon enregistré.");
}

export async function schedulePageRevisionAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const pageId = text(formData, "pageId");
    const revisionId = text(formData, "revisionId");
    const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
    await actorFor(page.worldKey, true);
    const expectedVersion = Number(formData.get("expectedVersion"));
    const scheduledPublishAtRaw = text(formData, "scheduledPublishAt");
    if (scheduledPublishAtRaw) {
      const scheduledDate = new Date(scheduledPublishAtRaw);
      if (Number.isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
        throw new Error("INVALID_SCHEDULE_DATE");
      }
    }
    const updated = await prisma.pageRevision.updateMany({
      where: { id: revisionId, pageId, status: "APPROVED", version: expectedVersion },
      data: {
        scheduledPublishAt: scheduledPublishAtRaw
          ? new Date(scheduledPublishAtRaw)
          : null,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });
    if (updated.count === 0) throw new Error("EDIT_CONFLICT");
    revalidatePath("/workspace/site-content");
    return {
      status: "success",
      message: scheduledPublishAtRaw
        ? "Publication programmée."
        : "Programmation annulée.",
    };
  } catch (error) {
    return toActionState(error);
  }
}

export async function createPreviewShareAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const pageId = text(formData, "pageId");
    const revisionId = text(formData, "revisionId");
    const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
    const { actor } = await actorFor(page.worldKey);
    const days = Number(formData.get("expiresInDays"));
    const expiresInDays = Number.isFinite(days) && days > 0 ? Math.min(days, 90) : 7;
    const label = text(formData, "label") || null;
    await prisma.pagePreviewShare.create({
      data: {
        token: randomUUID().replace(/-/g, ""),
        pageId,
        revisionId,
        label,
        createdById: actor.id,
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
      },
    });
    revalidatePath("/workspace/site-content");
    return { status: "success", message: "Lien de partage créé." };
  } catch (error) {
    return toActionState(error);
  }
}

export async function revokePreviewShareAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const id = text(formData, "id");
    const share = await prisma.pagePreviewShare.findUniqueOrThrow({
      where: { id },
      include: { page: true },
    });
    await actorFor(share.page.worldKey);
    await prisma.pagePreviewShare.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    revalidatePath("/workspace/site-content");
    return { status: "success", message: "Lien de partage révoqué." };
  } catch (error) {
    return toActionState(error);
  }
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
  const revisionId = text(formData, "revisionId");
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { worldKey: true, slug: true },
  });
  if (target === "APPROVED" && page && context.actor) {
    const revision = await prisma.pageRevision.findUnique({
      where: { id: revisionId },
      select: { createdById: true },
    });
    if (revision?.createdById === context.actor.id) {
      const otherApprovers = await eligibleApprovers(
        page.worldKey,
        context.actor.id,
      );
      if (otherApprovers.length > 0) {
        return toActionState(new Error("SELF_APPROVAL_BLOCKED"));
      }
    }
  }
  const result = await movePageRevision(revisionDependencies(), context, {
    pageId,
    revisionId,
    expectedVersion: Number(formData.get("expectedVersion")),
    target: target as Parameters<typeof movePageRevision>[2]["target"],
  });
  if (result.ok) {
    revalidatePath("/workspace/site-content");
    if (result.value.status === "PUBLISHED" && page) {
      revalidatePublicPage(page.worldKey, page.slug);
    }
    if (result.value.status === "IN_REVIEW" && page && context.actor) {
      await notifyReviewRequested(pageId, page.worldKey, context.actor.id);
    }
  }
  return resultState(result, "Étape de publication mise à jour.");
}

async function eligibleApprovers(
  worldKey: string,
  excludeUserId: string,
): Promise<readonly string[]> {
  const now = new Date();
  const assignments = await prisma.roleAssignment.findMany({
    where: {
      role: {
        in: [...PUBLISH_ROLES] as ("SUPER_ADMIN" | "ADMIN" | "WORLD_MANAGER")[],
      },
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      AND: [
        { OR: [{ scopeType: "GLOBAL" }, { world: { key: worldKey } }] },
      ],
      userId: { not: excludeUserId },
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  return assignments.map((assignment) => assignment.userId);
}

async function notifyReviewRequested(
  pageId: string,
  worldKey: string,
  submitterId: string,
): Promise<void> {
  const approverIds = await eligibleApprovers(worldKey, submitterId);
  if (approverIds.length === 0) return;
  const now = new Date();
  await prisma.notification.createMany({
    data: approverIds.map((userId) => ({
      id: `notification_${randomUUID()}`,
      userId,
      type: "REVIEW_REQUESTED",
      entityType: "PAGE",
      entityId: pageId,
      worldKey,
      createdAt: now,
    })),
  });
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
          ogImageMediaId: source.ogImageMediaId,
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

type TemplateSection = {
  sectionType: string;
  order: number;
  payload: Prisma.JsonValue;
  payloadSchemaVersion: number;
  globalComponentId: string | null;
};

function parseTemplateSections(value: Prisma.JsonValue): TemplateSection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    if (
      typeof record.sectionType !== "string" ||
      typeof record.order !== "number" ||
      typeof record.payloadSchemaVersion !== "number"
    ) {
      return [];
    }
    return [
      {
        sectionType: record.sectionType,
        order: record.order,
        payload: (record.payload ?? {}) as Prisma.JsonValue,
        payloadSchemaVersion: record.payloadSchemaVersion,
        globalComponentId:
          typeof record.globalComponentId === "string"
            ? record.globalComponentId
            : null,
      },
    ];
  });
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
    const templateId = text(formData, "templateId");
    const template = templateId
      ? await prisma.pageTemplate.findFirst({
          where: { id: templateId, worldKey },
        })
      : null;
    const templateSections = template
      ? parseTemplateSections(template.sections)
      : [];
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
      for (const section of templateSections) {
        await transaction.pageRevisionSection.create({
          data: {
            id: `revision_section_${randomUUID()}`,
            revisionId,
            sectionKey: `section_${randomUUID()}`,
            sectionType: section.sectionType,
            order: section.order,
            payload: section.payload as Prisma.InputJsonValue,
            payloadSchemaVersion: section.payloadSchemaVersion,
            globalComponentId: section.globalComponentId,
            version: 1,
            createdAt: now,
            updatedAt: now,
          },
        });
      }
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

async function uniquePageSlug(
  worldKey: string,
  pageType: string,
  baseSlug: string,
): Promise<string> {
  let candidate = `${baseSlug}-copie`;
  let suffix = 2;
  for (;;) {
    const existing = await prisma.page.findFirst({
      where: { worldKey, pageType, slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${baseSlug}-copie-${suffix}`;
    suffix += 1;
  }
}

export async function duplicatePageAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const worldKey = text(formData, "worldKey");
  let createdPageId: string | null = null;
  try {
    const sourcePageId = text(formData, "pageId");
    const { actor } = await actorFor(worldKey);
    const source = await prisma.page.findFirst({
      where: { id: sourcePageId, worldKey },
      include: {
        draftRevision: { include: { sections: { include: { mediaUsages: true } } } },
        publishedRevision: {
          include: { sections: { include: { mediaUsages: true } } },
        },
      },
    });
    if (!source) throw new Error("PAGE_NOT_FOUND");
    if (source.pageKind === "SYSTEM" || source.serviceId) {
      throw new Error("PAGE_NOT_DUPLICABLE");
    }
    const sourceRevision = source.draftRevision ?? source.publishedRevision;
    const slug = await uniquePageSlug(worldKey, source.pageType, source.slug);
    const now = new Date();
    await prisma.$transaction(async (transaction) => {
      const pageId = randomUUID();
      createdPageId = pageId;
      const revisionId = `revision_${randomUUID()}`;
      await transaction.page.create({
        data: {
          id: pageId,
          worldKey,
          pageType: source.pageType,
          templateKey: source.templateKey,
          title: `${source.title} (copie)`,
          slug,
          routePath:
            worldKey === "kwaliti-print" ? `/kwaliti-print/${slug}` : `/${slug}`,
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
          title: `${source.title} (copie)`,
          seoTitle: sourceRevision?.seoTitle ?? null,
          seoDescription: sourceRevision?.seoDescription ?? null,
          ogImageMediaId: sourceRevision?.ogImageMediaId ?? null,
          createdById: actor.id,
          createdAt: now,
          updatedAt: now,
          sections: {
            create: (sourceRevision?.sections ?? []).map((section) => ({
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

// A section can additionally be locked to a minimum role (restrictedRole,
// e.g. only ADMIN+ may touch the pricing block) on top of the normal
// page-edit permission everyone in EDIT_ROLES already has. Null means no
// extra restriction.
function assertSectionEditAllowed(
  actorRole: string | null,
  restrictedRole: string | null,
): void {
  if (!restrictedRole) return;
  const actorRank = ROLE_RANK[actorRole ?? ""] ?? Number.MAX_SAFE_INTEGER;
  const requiredRank = ROLE_RANK[restrictedRole] ?? 0;
  if (actorRank > requiredRank) throw new Error("SECTION_RESTRICTED");
}

/**
 * Undo/redo works as a linear timeline of full-section snapshots per
 * revision, with a cursor marking "where we are". Every mutation captures
 * a snapshot of the section list before and after itself; undo/redo just
 * moves the cursor and restores the section rows to match the snapshot at
 * the new position. A fresh edit after an undo drops the abandoned "future"
 * snapshots, same as any standard undo/redo stack.
 */
const MAX_SECTION_HISTORY = 40;

type SnapshotSection = {
  id: string;
  sectionKey: string;
  sectionType: string;
  order: number;
  payload: Prisma.JsonValue;
  payloadSchemaVersion: number;
  globalComponentId: string | null;
  mediaUsages: readonly { mediaId: string; slot: string; order: number }[];
};

async function captureSectionsSnapshot(
  transaction: Prisma.TransactionClient,
  revisionId: string,
): Promise<SnapshotSection[]> {
  const sections = await transaction.pageRevisionSection.findMany({
    where: { revisionId },
    orderBy: { order: "asc" },
    include: { mediaUsages: true },
  });
  return sections.map((section) => ({
    id: section.id,
    sectionKey: section.sectionKey,
    sectionType: section.sectionType,
    order: section.order,
    payload: section.payload,
    payloadSchemaVersion: section.payloadSchemaVersion,
    globalComponentId: section.globalComponentId,
    mediaUsages: section.mediaUsages.map((usage) => ({
      mediaId: usage.mediaId,
      slot: usage.slot,
      order: usage.order,
    })),
  }));
}

function parseSnapshotSections(value: Prisma.JsonValue): SnapshotSection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      typeof record.sectionKey !== "string" ||
      typeof record.sectionType !== "string" ||
      typeof record.order !== "number" ||
      typeof record.payloadSchemaVersion !== "number"
    ) {
      return [];
    }
    const mediaUsages = Array.isArray(record.mediaUsages)
      ? record.mediaUsages.flatMap((usage) => {
          if (!usage || typeof usage !== "object" || Array.isArray(usage))
            return [];
          const usageRecord = usage as Record<string, unknown>;
          return typeof usageRecord.mediaId === "string" &&
            typeof usageRecord.slot === "string" &&
            typeof usageRecord.order === "number"
            ? [
                {
                  mediaId: usageRecord.mediaId,
                  slot: usageRecord.slot,
                  order: usageRecord.order,
                },
              ]
            : [];
        })
      : [];
    return [
      {
        id: record.id,
        sectionKey: record.sectionKey,
        sectionType: record.sectionType,
        order: record.order,
        payload: (record.payload ?? {}) as Prisma.JsonValue,
        payloadSchemaVersion: record.payloadSchemaVersion,
        globalComponentId:
          typeof record.globalComponentId === "string"
            ? record.globalComponentId
            : null,
        mediaUsages,
      },
    ];
  });
}

/**
 * Call at the start of a mutating transaction. Drops any redo tail left
 * over from a previous undo, and makes sure the state right before this
 * edit is captured (a no-op after the first call for a given cursor
 * position, since the previous mutation's "after" snapshot already covers
 * it).
 */
async function beginSectionHistory(
  transaction: Prisma.TransactionClient,
  revisionId: string,
): Promise<number> {
  const revision = await transaction.pageRevision.findUniqueOrThrow({
    where: { id: revisionId },
    select: { snapshotCursor: true },
  });
  const cursor = revision.snapshotCursor;
  await transaction.pageRevisionSnapshot.deleteMany({
    where: { revisionId, sequence: { gt: cursor } },
  });
  const existing = await transaction.pageRevisionSnapshot.findUnique({
    where: { revisionId_sequence: { revisionId, sequence: cursor } },
  });
  if (!existing) {
    await transaction.pageRevisionSnapshot.create({
      data: {
        id: `revision_snapshot_${randomUUID()}`,
        revisionId,
        sequence: cursor,
        sections: (await captureSectionsSnapshot(
          transaction,
          revisionId,
        )) as unknown as Prisma.InputJsonValue,
      },
    });
  }
  return cursor;
}

/**
 * Call at the end of a mutating transaction, once the section rows already
 * reflect the change. Returns the new snapshotCursor to persist on the
 * revision (merge it into that transaction's existing
 * `pageRevision.update` call alongside the version bump).
 */
async function endSectionHistory(
  transaction: Prisma.TransactionClient,
  revisionId: string,
  cursor: number,
): Promise<number> {
  const nextSequence = cursor + 1;
  await transaction.pageRevisionSnapshot.create({
    data: {
      id: `revision_snapshot_${randomUUID()}`,
      revisionId,
      sequence: nextSequence,
      sections: (await captureSectionsSnapshot(
        transaction,
        revisionId,
      )) as unknown as Prisma.InputJsonValue,
    },
  });
  await transaction.pageRevisionSnapshot.deleteMany({
    where: {
      revisionId,
      sequence: { lt: nextSequence - MAX_SECTION_HISTORY },
    },
  });
  return nextSequence;
}

async function restoreSectionsSnapshot(
  transaction: Prisma.TransactionClient,
  pageId: string,
  revisionId: string,
  sectionsJson: Prisma.JsonValue,
  now: Date,
): Promise<void> {
  const snapshotSections = parseSnapshotSections(sectionsJson);
  const current = await transaction.pageRevisionSection.findMany({
    where: { revisionId },
    select: { id: true },
  });
  const currentIds = new Set(current.map((section) => section.id));
  const snapshotIds = new Set(snapshotSections.map((section) => section.id));
  const toDelete = [...currentIds].filter((id) => !snapshotIds.has(id));
  if (toDelete.length > 0) {
    await transaction.sectionMediaUsage.deleteMany({
      where: { sectionId: { in: toDelete } },
    });
    await transaction.pageRevisionSection.deleteMany({
      where: { id: { in: toDelete } },
    });
  }
  for (const section of snapshotSections) {
    if (currentIds.has(section.id)) {
      await transaction.pageRevisionSection.update({
        where: { id: section.id },
        data: {
          sectionType: section.sectionType,
          order: section.order,
          payload: section.payload as Prisma.InputJsonValue,
          payloadSchemaVersion: section.payloadSchemaVersion,
          globalComponentId: section.globalComponentId,
          version: { increment: 1 },
          updatedAt: now,
        },
      });
    } else {
      await transaction.pageRevisionSection.create({
        data: {
          id: section.id,
          revisionId,
          sectionKey: section.sectionKey,
          sectionType: section.sectionType,
          order: section.order,
          payload: section.payload as Prisma.InputJsonValue,
          payloadSchemaVersion: section.payloadSchemaVersion,
          globalComponentId: section.globalComponentId,
          version: 1,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
    await transaction.sectionMediaUsage.deleteMany({
      where: { sectionId: section.id },
    });
    if (section.mediaUsages.length > 0) {
      await transaction.sectionMediaUsage.createMany({
        data: section.mediaUsages.map((usage) => ({
          sectionId: section.id,
          ...usage,
        })),
      });
    }
  }
  await transaction.page.update({
    where: { id: pageId },
    data: { updatedAt: now },
  });
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
    const historyCursor = await beginSectionHistory(
      transaction,
      input.revisionId,
    );
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
    const nextSequence = await endSectionHistory(
      transaction,
      input.revisionId,
      historyCursor,
    );
    await transaction.pageRevision.update({
      where: { id: input.revisionId },
      data: {
        version: { increment: 1 },
        snapshotCursor: nextSequence,
        updatedAt: input.now,
      },
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
      const historyCursor = await beginSectionHistory(transaction, revisionId);
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
      const nextSequence = await endSectionHistory(
        transaction,
        revisionId,
        historyCursor,
      );
      await transaction.pageRevision.update({
        where: { id: revisionId },
        data: {
          version: { increment: 1 },
          snapshotCursor: nextSequence,
          updatedAt: now,
        },
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
      const historyCursor = await beginSectionHistory(transaction, revisionId);
      await Promise.all(
        orderedIds.map((id, order) =>
          transaction.pageRevisionSection.update({
            where: { id },
            data: { order, updatedAt: now },
          }),
        ),
      );
      const nextSequence = await endSectionHistory(
        transaction,
        revisionId,
        historyCursor,
      );
      await transaction.pageRevision.update({
        where: { id: revisionId },
        data: { snapshotCursor: nextSequence },
      });
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
    const { actor } = await actorFor(page.worldKey);
    const revisionId = text(formData, "revisionId");
    if (!revisionId) throw new Error("PAGE_NOT_DRAFT");
    await assertEditableRevision(page.id, revisionId);
    const sectionId = text(formData, "id") || null;
    if (sectionId) {
      const existing = await prisma.pageRevisionSection.findFirst({
        where: { id: sectionId, revisionId },
        select: { restrictedRole: true },
      });
      if (!existing) throw new Error("SECTION_PAGE_MISMATCH");
      assertSectionEditAllowed(actor.role, existing.restrictedRole);
    }
    const payload = parsePayload(text(formData, "payload"));
    await saveRevisionSection({
      id: sectionId,
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
  "html",
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
  if (formData.has("hasResponsiveVisibility")) {
    for (const key of RESPONSIVE_VISIBILITY_KEYS) {
      if (formData.has(key)) payload[key] = true;
      else delete payload[key];
    }
  }
}

const RESPONSIVE_VISIBILITY_KEYS = [
  "hideOnDesktop",
  "hideOnTablet",
  "hideOnMobile",
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
    const { actor } = await actorFor(page.worldKey);
    const revisionId = text(formData, "revisionId");
    if (!revisionId) throw new Error("PAGE_NOT_DRAFT");
    await assertEditableRevision(page.id, revisionId);
    const id = text(formData, "id");
    const existing = await prisma.pageRevisionSection.findFirst({
      where: { id, revisionId },
    });
    if (!existing) throw new Error("SECTION_PAGE_MISMATCH");
    assertSectionEditAllowed(actor.role, existing.restrictedRole);
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
    if (formData.has("hasItems")) {
      const titles = formData.getAll("itemTitle").map(String);
      const texts = formData.getAll("itemText").map(String);
      const rowCount = Math.max(titles.length, texts.length);
      payload.items = Array.from({ length: rowCount }, (_, index) => ({
        title: (titles[index] ?? "").trim(),
        text: (texts[index] ?? "").trim(),
      })).filter((item) => item.title || item.text);
    }
    if (existing.sectionType === "COLUMNS" && formData.has("columnsJson")) {
      const { columnCount, columns } = parseColumnsPayload(
        text(formData, "columnsJson"),
      );
      payload.columnCount = columnCount;
      payload.columns = columns;
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
      assertSectionEditAllowed(actor.role, section.restrictedRole);
      const historyCursor = await beginSectionHistory(transaction, revisionId);
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
      const nextSequence = await endSectionHistory(
        transaction,
        revisionId,
        historyCursor,
      );
      await transaction.pageRevision.update({
        where: { id: revisionId },
        data: {
          version: { increment: 1 },
          snapshotCursor: nextSequence,
          updatedAt: now,
        },
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

const SECTION_RESTRICTABLE_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "WORLD_MANAGER",
  "EDITOR",
]);

// Only PUBLISH_ROLES may lock a block down or unlock it -- an EDITOR
// shouldn't be able to hand themselves a section only ADMIN+ can touch,
// nor lock a colleague out of a block they're currently relying on.
export async function setSectionRestrictionAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const pageId = text(formData, "pageId");
    const revisionId = text(formData, "revisionId");
    const sectionId = text(formData, "sectionId");
    const restrictedRole = text(formData, "restrictedRole");
    if (restrictedRole && !SECTION_RESTRICTABLE_ROLES.has(restrictedRole)) {
      throw new Error("INVALID_SECTION_PAYLOAD");
    }
    const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
    await actorFor(page.worldKey, true);
    await assertEditableRevision(pageId, revisionId);
    const updated = await prisma.pageRevisionSection.updateMany({
      where: { id: sectionId, revisionId },
      data: {
        restrictedRole: restrictedRole ? (restrictedRole as AccessRole) : null,
      },
    });
    if (updated.count !== 1) throw new Error("SECTION_PAGE_MISMATCH");
    revalidatePath("/workspace/site-content");
    return {
      status: "success",
      message: restrictedRole
        ? "Restriction appliquée à ce bloc."
        : "Restriction retirée de ce bloc.",
    };
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
      const historyCursor = await beginSectionHistory(transaction, revisionId);
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
      const nextSequence = await endSectionHistory(
        transaction,
        revisionId,
        historyCursor,
      );
      await transaction.pageRevision.update({
        where: { id: revisionId },
        data: {
          version: { increment: 1 },
          snapshotCursor: nextSequence,
          updatedAt: now,
        },
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

export async function undoPageEditAction(
  formData: FormData,
): Promise<ActionState> {
  try {
    const pageId = text(formData, "pageId");
    const revisionId = text(formData, "revisionId");
    const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
    await actorFor(page.worldKey);
    await assertEditableRevision(pageId, revisionId);
    await prisma.$transaction(async (transaction) => {
      const revision = await transaction.pageRevision.findUniqueOrThrow({
        where: { id: revisionId },
        select: { snapshotCursor: true },
      });
      if (revision.snapshotCursor <= 0) throw new Error("NOTHING_TO_UNDO");
      const targetSequence = revision.snapshotCursor - 1;
      const target = await transaction.pageRevisionSnapshot.findUnique({
        where: { revisionId_sequence: { revisionId, sequence: targetSequence } },
      });
      if (!target) throw new Error("NOTHING_TO_UNDO");
      const now = new Date();
      await restoreSectionsSnapshot(
        transaction,
        pageId,
        revisionId,
        target.sections,
        now,
      );
      await transaction.pageRevision.update({
        where: { id: revisionId },
        data: {
          snapshotCursor: targetSequence,
          version: { increment: 1 },
          updatedAt: now,
        },
      });
    });
    revalidatePath("/workspace/site-content");
    return { status: "success", message: "Modification annulée." };
  } catch (error) {
    return toActionState(error);
  }
}

export async function redoPageEditAction(
  formData: FormData,
): Promise<ActionState> {
  try {
    const pageId = text(formData, "pageId");
    const revisionId = text(formData, "revisionId");
    const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
    await actorFor(page.worldKey);
    await assertEditableRevision(pageId, revisionId);
    await prisma.$transaction(async (transaction) => {
      const revision = await transaction.pageRevision.findUniqueOrThrow({
        where: { id: revisionId },
        select: { snapshotCursor: true },
      });
      const targetSequence = revision.snapshotCursor + 1;
      const target = await transaction.pageRevisionSnapshot.findUnique({
        where: { revisionId_sequence: { revisionId, sequence: targetSequence } },
      });
      if (!target) throw new Error("NOTHING_TO_REDO");
      const now = new Date();
      await restoreSectionsSnapshot(
        transaction,
        pageId,
        revisionId,
        target.sections,
        now,
      );
      await transaction.pageRevision.update({
        where: { id: revisionId },
        data: {
          snapshotCursor: targetSequence,
          version: { increment: 1 },
          updatedAt: now,
        },
      });
    });
    revalidatePath("/workspace/site-content");
    return { status: "success", message: "Modification rétablie." };
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
    const ogImageUsageCount = await prisma.pageRevision.count({
      where: { ogImageMediaId: asset.id },
    });
    if (revisionUsageCount > 0 || identityUsageCount > 0 || ogImageUsageCount > 0) {
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

export async function updateMediaDetailsAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const id = text(formData, "id");
    const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id } });
    await actorFor(asset.worldKey);
    const rightsExpiresAtRaw = text(formData, "rightsExpiresAt");
    await prisma.mediaAsset.update({
      where: { id },
      data: {
        title: text(formData, "title") || asset.title,
        altText: text(formData, "altText"),
        caption: text(formData, "caption") || null,
        credit: text(formData, "credit") || null,
        rightsStatement: text(formData, "rightsStatement") || null,
        rightsExpiresAt: rightsExpiresAtRaw ? new Date(rightsExpiresAtRaw) : null,
        tags: text(formData, "tags")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      },
    });
    revalidatePath("/workspace/site-content");
    return { status: "success", message: "Détails du média enregistrés." };
  } catch (error) {
    return toActionState(error);
  }
}

// ---------------------------------------------------------------------------
// Global components ("symbols"): a reusable block whose canonical, editable
// content lives as one PageRevisionSection on a hidden per-world "component
// library" page. Other pages embed it as a lightweight instance (a section
// row with globalComponentId set and no payload of its own); the public
// renderer and the builder's own iframe preview -- which is just that same
// public route in preview mode -- resolve instances to the component's live
// payload at render time (see resolveEffectiveSection in
// (marketing)/[slug]/page.tsx), so editing the source through the normal
// page builder updates every instance immediately.
// ---------------------------------------------------------------------------

const COMPONENT_LIBRARY_SLUG = "__component_library__";

async function ensureComponentLibraryPage(
  transaction: Prisma.TransactionClient,
  worldKey: string,
  actorId: string | undefined,
  now: Date,
): Promise<{ pageId: string; revisionId: string }> {
  const existing = await transaction.page.findFirst({
    where: { worldKey, pageKind: "COMPONENT_LIBRARY" },
    select: { id: true, draftRevisionId: true },
  });
  if (existing?.draftRevisionId) {
    return { pageId: existing.id, revisionId: existing.draftRevisionId };
  }
  if (existing) throw new Error("COMPONENT_NOT_FOUND");
  const pageId = randomUUID();
  const revisionId = `revision_${randomUUID()}`;
  await transaction.page.create({
    data: {
      id: pageId,
      worldKey,
      pageType: "LANDING",
      pageKind: "COMPONENT_LIBRARY",
      title: "Bibliothèque de composants",
      slug: COMPONENT_LIBRARY_SLUG,
      routePath: null,
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
      title: "Bibliothèque de composants",
      createdById: actorId,
      createdAt: now,
      updatedAt: now,
    },
  });
  await transaction.page.update({
    where: { id: pageId },
    data: { draftRevisionId: revisionId },
  });
  return { pageId, revisionId };
}

export async function createGlobalComponentAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const worldKey = text(formData, "worldKey");
    const name = text(formData, "name");
    const sectionType = text(formData, "sectionType");
    if (!name) throw new Error("COMPONENT_NAME_REQUIRED");
    if (!isPageBlockType(sectionType)) {
      throw new Error("INVALID_SECTION_PAYLOAD");
    }
    const { actor } = await actorFor(worldKey);
    const existingName = await prisma.globalComponent.findUnique({
      where: { worldKey_name: { worldKey, name } },
      select: { id: true },
    });
    if (existingName) throw new Error("COMPONENT_NAME_TAKEN");
    const now = new Date();
    await prisma.$transaction(async (transaction) => {
      const { revisionId } = await ensureComponentLibraryPage(
        transaction,
        worldKey,
        actor.id,
        now,
      );
      const aggregate = await transaction.pageRevisionSection.aggregate({
        where: { revisionId },
        _max: { order: true },
      });
      const sourceSectionId = `revision_section_${randomUUID()}`;
      await transaction.pageRevisionSection.create({
        data: {
          id: sourceSectionId,
          revisionId,
          sectionKey: `section_${randomUUID()}`,
          sectionType,
          order: (aggregate._max.order ?? -1) + 1,
          payload: createDefaultBlockPayload(
            sectionType,
          ) as Prisma.InputJsonValue,
          payloadSchemaVersion: 1,
          version: 1,
          createdAt: now,
          updatedAt: now,
        },
      });
      await transaction.globalComponent.create({
        data: {
          id: `global_component_${randomUUID()}`,
          worldKey,
          name,
          sectionType,
          sourceSectionId,
          createdAt: now,
          updatedAt: now,
        },
      });
    });
    revalidatePath("/workspace/site-content/components");
    return { status: "success", message: "Composant global créé." };
  } catch (error) {
    return toActionState(error);
  }
}

export async function insertGlobalComponentInstanceAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const pageId = text(formData, "pageId");
    const revisionId = text(formData, "revisionId");
    const componentId = text(formData, "componentId");
    const page = await prisma.page.findUniqueOrThrow({ where: { id: pageId } });
    await actorFor(page.worldKey);
    await assertEditableRevision(pageId, revisionId);
    const component = await prisma.globalComponent.findUnique({
      where: { id: componentId },
    });
    if (!component || component.worldKey !== page.worldKey) {
      throw new Error("COMPONENT_NOT_FOUND");
    }
    const now = new Date();
    await prisma.$transaction(async (transaction) => {
      const historyCursor = await beginSectionHistory(transaction, revisionId);
      const aggregate = await transaction.pageRevisionSection.aggregate({
        where: { revisionId },
        _max: { order: true },
      });
      await transaction.pageRevisionSection.create({
        data: {
          id: `revision_section_${randomUUID()}`,
          revisionId,
          sectionKey: `section_${randomUUID()}`,
          sectionType: component.sectionType,
          order: (aggregate._max.order ?? -1) + 1,
          payload: {},
          payloadSchemaVersion: 1,
          version: 1,
          globalComponentId: component.id,
          createdAt: now,
          updatedAt: now,
        },
      });
      const nextSequence = await endSectionHistory(
        transaction,
        revisionId,
        historyCursor,
      );
      await transaction.pageRevision.update({
        where: { id: revisionId },
        data: {
          version: { increment: 1 },
          snapshotCursor: nextSequence,
          updatedAt: now,
        },
      });
      await transaction.page.update({
        where: { id: pageId },
        data: { updatedAt: now },
      });
    });
    revalidatePath("/workspace/site-content");
    return { status: "success", message: "Composant ajouté à la page." };
  } catch (error) {
    return toActionState(error);
  }
}

export async function detachGlobalComponentInstanceAction(
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
    const section = await prisma.pageRevisionSection.findFirst({
      where: { id: sectionId, revisionId },
      include: {
        globalComponent: {
          include: { sourceSection: { include: { mediaUsages: true } } },
        },
      },
    });
    if (!section?.globalComponentId || !section.globalComponent) {
      throw new Error("SECTION_NOT_A_COMPONENT_INSTANCE");
    }
    const source = section.globalComponent.sourceSection;
    const now = new Date();
    await prisma.$transaction(async (transaction) => {
      const historyCursor = await beginSectionHistory(transaction, revisionId);
      await transaction.pageRevisionSection.update({
        where: { id: sectionId },
        data: {
          sectionType: source.sectionType,
          payload: source.payload as Prisma.InputJsonValue,
          payloadSchemaVersion: source.payloadSchemaVersion,
          globalComponentId: null,
          version: { increment: 1 },
          updatedAt: now,
        },
      });
      await transaction.sectionMediaUsage.deleteMany({
        where: { sectionId },
      });
      if (source.mediaUsages.length > 0) {
        await transaction.sectionMediaUsage.createMany({
          data: source.mediaUsages.map((usage) => ({
            sectionId,
            mediaId: usage.mediaId,
            slot: usage.slot,
            order: usage.order,
          })),
        });
      }
      const nextSequence = await endSectionHistory(
        transaction,
        revisionId,
        historyCursor,
      );
      await transaction.pageRevision.update({
        where: { id: revisionId },
        data: {
          version: { increment: 1 },
          snapshotCursor: nextSequence,
          updatedAt: now,
        },
      });
      await transaction.page.update({
        where: { id: pageId },
        data: { updatedAt: now },
      });
    });
    revalidatePath("/workspace/site-content");
    return {
      status: "success",
      message: "Composant détaché : ce bloc est maintenant indépendant.",
    };
  } catch (error) {
    return toActionState(error);
  }
}

export async function deleteGlobalComponentAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const componentId = text(formData, "componentId");
    const component = await prisma.globalComponent.findUniqueOrThrow({
      where: { id: componentId },
    });
    await actorFor(component.worldKey);
    const instanceCount = await prisma.pageRevisionSection.count({
      where: { globalComponentId: componentId },
    });
    if (instanceCount > 0) throw new Error("COMPONENT_IN_USE");
    await prisma.$transaction(async (transaction) => {
      await transaction.globalComponent.delete({ where: { id: componentId } });
      await transaction.sectionMediaUsage.deleteMany({
        where: { sectionId: component.sourceSectionId },
      });
      await transaction.pageRevisionSection.delete({
        where: { id: component.sourceSectionId },
      });
    });
    revalidatePath("/workspace/site-content/components");
    return { status: "success", message: "Composant global supprimé." };
  } catch (error) {
    return toActionState(error);
  }
}

// ---------------------------------------------------------------------------
// Page templates: a one-shot snapshot of a page's current sections, applied
// when creating a new page (see createPageAction above). Unlike global
// components, a template never stays linked to the page it was captured
// from -- copying it is the whole point, not sharing a live source.
// ---------------------------------------------------------------------------

export async function saveTemplateFromPageAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const pageId = text(formData, "pageId");
    const revisionId = text(formData, "revisionId");
    const worldKey = text(formData, "worldKey");
    const name = text(formData, "name");
    if (!name) throw new Error("TEMPLATE_NAME_REQUIRED");
    await actorFor(worldKey);
    await assertEditableRevision(pageId, revisionId);
    const sections = await prisma.pageRevisionSection.findMany({
      where: { revisionId },
      orderBy: { order: "asc" },
    });
    if (sections.length === 0) throw new Error("TEMPLATE_EMPTY");
    const existingName = await prisma.pageTemplate.findUnique({
      where: { worldKey_name: { worldKey, name } },
      select: { id: true },
    });
    if (existingName) throw new Error("TEMPLATE_NAME_TAKEN");
    const snapshot: TemplateSection[] = sections.map((section) => ({
      sectionType: section.sectionType,
      order: section.order,
      payload: section.payload,
      payloadSchemaVersion: section.payloadSchemaVersion,
      globalComponentId: section.globalComponentId,
    }));
    await prisma.pageTemplate.create({
      data: {
        id: `page_template_${randomUUID()}`,
        worldKey,
        name,
        sections: snapshot as unknown as Prisma.InputJsonValue,
      },
    });
    revalidatePath("/workspace/site-content/templates");
    return { status: "success", message: "Gabarit enregistré." };
  } catch (error) {
    return toActionState(error);
  }
}

export async function deletePageTemplateAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const templateId = text(formData, "templateId");
    const template = await prisma.pageTemplate.findUniqueOrThrow({
      where: { id: templateId },
    });
    await actorFor(template.worldKey);
    await prisma.pageTemplate.delete({ where: { id: templateId } });
    revalidatePath("/workspace/site-content/templates");
    return { status: "success", message: "Gabarit supprimé." };
  } catch (error) {
    return toActionState(error);
  }
}
