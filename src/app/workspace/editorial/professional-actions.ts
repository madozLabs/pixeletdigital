"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { prisma } from "@/infrastructure/shared/prisma-client";
import type { ActionState } from "../_components/feedback";
import { requireWorldAccess } from "../_lib/authorization";
import { getWorkspaceRequestContext } from "../get-workspace-context";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, key: string): string | null {
  return text(formData, key) || null;
}

function canMutate(role: string | null | undefined): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "WORLD_MANAGER" ||
    role === "EDITOR"
  );
}

// Same column order as EditorialWorkflowForm's <select> and pipeline-board.tsx's
// COLUMNS -- used only to detect a backward move (going to CANCELLED is
// always treated as backward too), not to validate the transition itself.
const EDITORIAL_STATUS_ORDER = [
  "DRAFT",
  "INTERNAL_REVIEW",
  "CLIENT_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
] as const;

function isBackwardTransition(from: string, to: string): boolean {
  if (to === "CANCELLED") return true;
  const fromIndex = EDITORIAL_STATUS_ORDER.indexOf(
    from as (typeof EDITORIAL_STATUS_ORDER)[number],
  );
  const toIndex = EDITORIAL_STATUS_ORDER.indexOf(
    to as (typeof EDITORIAL_STATUS_ORDER)[number],
  );
  return fromIndex >= 0 && toIndex >= 0 && toIndex < fromIndex;
}

export async function createProfessionalEditorialItemAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !canMutate(context.actor.role)) {
    return {
      status: "error",
      message: "Vous n'êtes pas autorisé à planifier un contenu.",
    };
  }

  const title = text(formData, "title");
  const channel = text(formData, "channel");
  const scheduledForRaw = text(formData, "scheduledFor");
  if (!title || !channel || !scheduledForRaw) {
    return {
      status: "error",
      message: "Le titre, le canal et la date de publication sont requis.",
    };
  }

  const worldKey = text(formData, "worldKey");
  try {
    requireWorldAccess(context.actor, worldKey);

    const clientId = optionalText(formData, "clientId");
    const client = clientId
      ? await prisma.client.findUnique({ where: { id: clientId } })
      : null;
    const scheduledFor = new Date(scheduledForRaw);
    const productionDueAt = optionalText(formData, "productionDueAt");

    await prisma.editorialItem.create({
      data: {
        id: randomUUID(),
        worldKey,
        clientId,
        projectId: optionalText(formData, "projectId"),
        ownerId: optionalText(formData, "ownerId"),
        reviewerId: optionalText(formData, "reviewerId"),
        linkedPageId: optionalText(formData, "linkedPageId"),
        clientLabel: client?.name ?? text(formData, "clientLabel"),
        channel,
        contentType: text(formData, "contentType") as
          | "POST"
          | "STORY"
          | "REEL"
          | "VIDEO"
          | "ARTICLE"
          | "EMAIL"
          | "AD"
          | "OTHER",
        title,
        brief: optionalText(formData, "brief"),
        productionDueAt: productionDueAt ? new Date(productionDueAt) : null,
        scheduledFor,
        status: "DRAFT",
        notes: optionalText(formData, "notes"),
        version: 1,
        createdAt: context.clock.now(),
        updatedAt: context.clock.now(),
      },
    });
    revalidatePath("/workspace/editorial");
    return { status: "success", message: "Contenu planifié." };
  } catch (error) {
    console.error("createProfessionalEditorialItem failed", error);
    return {
      status: "error",
      message: "Le contenu n'a pas pu être planifié. Merci de réessayer.",
    };
  }
}

const PIPELINE_STATUSES = [
  "DRAFT",
  "INTERNAL_REVIEW",
  "CLIENT_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
] as const;

export type MoveEditorialItemResult = Readonly<
  { ok: true } | { ok: false; message: string }
>;

/**
 * Drag-and-drop move on the pipeline board. Only touches status and the
 * matching workflow timestamps -- same side effects as
 * advanceEditorialWorkflowAction but callable directly from a client
 * component with plain arguments, so it returns a result object instead of
 * the ActionState shape (which is tied to useActionState/<form>).
 */
export async function moveEditorialItemAction(
  itemId: string,
  status: string,
): Promise<MoveEditorialItemResult> {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !canMutate(context.actor.role)) {
    return {
      ok: false,
      message: "Vous n'êtes pas autorisé à déplacer ce contenu.",
    };
  }
  if (
    !PIPELINE_STATUSES.includes(status as (typeof PIPELINE_STATUSES)[number])
  ) {
    return { ok: false, message: "Statut invalide." };
  }

  try {
    const item = await prisma.editorialItem.findUnique({
      where: { id: itemId },
      select: { worldKey: true, version: true, status: true },
    });
    if (!item || item.status === "CANCELLED") {
      return { ok: false, message: "Ce contenu n'est plus disponible." };
    }
    requireWorldAccess(context.actor, item.worldKey);

    const now = context.clock.now();
    const data: Record<string, unknown> = {
      status,
      version: { increment: 1 },
      updatedAt: now,
    };
    if (status === "APPROVED") data.internalApprovedAt = now;
    if (status === "SCHEDULED") data.clientApprovedAt = now;
    if (status === "PUBLISHED") data.realizedAt = now;
    // Drag-and-drop has no text field to capture a reason -- clear any
    // stale one from a previous form-based transition rather than leave it
    // displayed against a status it no longer applies to.
    data.statusChangeReason = null;

    await prisma.editorialItem.update({
      where: { id: itemId, version: item.version },
      data,
    });
    revalidatePath("/workspace/editorial");
    return { ok: true };
  } catch (error) {
    console.error("moveEditorialItem failed", error);
    return {
      ok: false,
      message:
        "Le déplacement n'a pas pu être enregistré (le contenu a peut-être changé entre-temps).",
    };
  }
}

export async function advanceEditorialWorkflowAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !canMutate(context.actor.role)) {
    return {
      status: "error",
      message: "Vous n'êtes pas autorisé à modifier ce contenu.",
    };
  }

  const itemId = text(formData, "itemId");
  try {
    const item = await prisma.editorialItem.findUnique({
      where: { id: itemId },
      select: { worldKey: true, version: true, status: true },
    });
    if (!item) {
      return { status: "error", message: "Ce contenu n'existe plus." };
    }
    requireWorldAccess(context.actor, item.worldKey);
    const expectedVersion = Number(formData.get("expectedVersion"));
    if (item.version !== expectedVersion) {
      return {
        status: "error",
        message: "Ce contenu a changé depuis son dernier chargement.",
      };
    }

    const nextStatus = text(formData, "status") as
      | "DRAFT"
      | "INTERNAL_REVIEW"
      | "CLIENT_REVIEW"
      | "APPROVED"
      | "SCHEDULED"
      | "PUBLISHED"
      | "CANCELLED";
    const now = context.clock.now();
    const data: Record<string, unknown> = {
      status: nextStatus,
      version: { increment: 1 },
      updatedAt: now,
    };
    if (nextStatus === "APPROVED") data.internalApprovedAt = now;
    if (nextStatus === "SCHEDULED") data.clientApprovedAt = now;
    if (nextStatus === "PUBLISHED") {
      data.realizedAt = now;
      data.proofUrl = optionalText(formData, "proofUrl");
    }
    data.statusChangeReason = isBackwardTransition(item.status, nextStatus)
      ? optionalText(formData, "reason")
      : null;

    await prisma.editorialItem.update({
      where: { id: itemId, version: expectedVersion },
      data,
    });
    revalidatePath("/workspace/editorial");
    return { status: "success", message: "Contenu mis à jour." };
  } catch (error) {
    console.error("advanceEditorialWorkflow failed", error);
    return {
      status: "error",
      message:
        "La mise à jour n'a pas pu être enregistrée. Merci de réessayer.",
    };
  }
}
