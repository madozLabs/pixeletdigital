"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { prisma } from "@/infrastructure/shared/prisma-client";
import {
  cancelEditorialItem,
  createDraftEditorialItem,
  markEditorialItemDone,
} from "@/modules/editorial/application/editorial-item-use-cases";
import { PrismaEditorialItemRepository } from "@/modules/editorial/infrastructure/prisma-editorial-item-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { getWorkspaceRequestContext } from "../get-workspace-context";

function dependencies() {
  return {
    editorialItems: new PrismaEditorialItemRepository(prisma),
    worlds: new PrismaWorldRepository(prisma),
  };
}

export async function createEditorialItemAction(
  formData: FormData,
): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

  const worldKey = String(formData.get("worldKey"));
  const scheduledForRaw = String(formData.get("scheduledFor"));
  const scheduledFor = new Date(scheduledForRaw);

  const result = await createDraftEditorialItem(dependencies(), context, {
    id: randomUUID(),
    worldKey,
    clientLabel: String(formData.get("clientLabel")),
    channel: String(formData.get("channel")),
    title: String(formData.get("title")),
    scheduledFor,
    notes: String(formData.get("notes") ?? ""),
  });
  if (!result.ok) {
    console.error("createDraftEditorialItem failed", result.error);
  }
  revalidatePath("/workspace/editorial");
}

export async function markEditorialItemDoneAction(
  formData: FormData,
): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

  const result = await markEditorialItemDone(dependencies(), context, {
    id: String(formData.get("id")),
    expectedVersion: Number(formData.get("expectedVersion")),
    proofUrl: String(formData.get("proofUrl")),
  });
  if (!result.ok) {
    console.error("markEditorialItemDone failed", result.error);
  }
  revalidatePath("/workspace/editorial");
}

export async function cancelEditorialItemAction(
  formData: FormData,
): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

  const result = await cancelEditorialItem(dependencies(), context, {
    id: String(formData.get("id")),
    expectedVersion: Number(formData.get("expectedVersion")),
  });
  if (!result.ok) {
    console.error("cancelEditorialItem failed", result.error);
  }
  revalidatePath("/workspace/editorial");
}
