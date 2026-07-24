"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { prisma } from "@/infrastructure/shared/prisma-client";
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
export async function createProfessionalEditorialItemAction(
  formData: FormData,
): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !canMutate(context.actor.role)) return;

  const worldKey = text(formData, "worldKey");
  requireWorldAccess(context.actor, worldKey);

  const clientId = optionalText(formData, "clientId");
  const client = clientId
    ? await prisma.client.findUnique({ where: { id: clientId } })
    : null;
  const scheduledFor = new Date(text(formData, "scheduledFor"));
  const productionDueAt = optionalText(formData, "productionDueAt");

  await prisma.editorialItem.create({
    data: {
      id: randomUUID(),
      worldKey: text(formData, "worldKey"),
      clientId,
      projectId: optionalText(formData, "projectId"),
      ownerId: optionalText(formData, "ownerId"),
      reviewerId: optionalText(formData, "reviewerId"),
      clientLabel: client?.name ?? text(formData, "clientLabel"),
      channel: text(formData, "channel"),
      contentType: text(formData, "contentType") as
        | "POST"
        | "STORY"
        | "REEL"
        | "VIDEO"
        | "ARTICLE"
        | "EMAIL"
        | "AD"
        | "OTHER",
      title: text(formData, "title"),
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
}
export async function advanceEditorialWorkflowAction(
  formData: FormData,
): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !canMutate(context.actor.role)) return;

  const itemId = text(formData, "itemId");
  const item = await prisma.editorialItem.findUnique({
    where: { id: itemId },
    select: { worldKey: true, version: true },
  });
  if (!item) return;
  requireWorldAccess(context.actor, item.worldKey);
  const expectedVersion = Number(formData.get("expectedVersion"));
  if (item.version !== expectedVersion) return;

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

  try {
    await prisma.editorialItem.update({
      where: { id: itemId, version: expectedVersion },
      data,
    });
  } catch {
    return;
  }
  revalidatePath("/workspace/editorial");
}
