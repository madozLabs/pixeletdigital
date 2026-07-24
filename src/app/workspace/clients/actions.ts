"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getWorkspaceRequestContext } from "../get-workspace-context";

export type ClientActionState = Readonly<{
  status: "idle" | "success" | "error";
  message?: string;
}>;

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, key: string): string | null {
  return text(formData, key) || null;
}

function canManageClients(role: string | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "WORLD_MANAGER";
}
export async function createProfessionalClientAction(
  _state: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  void _state;
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !canManageClients(context.actor.role)) {
    return { status: "error", message: "Action non autorisée." };
  }

  const worldKey = text(formData, "worldKey");
  const world = await prisma.world.findUnique({ where: { key: worldKey } });
  if (!world) return { status: "error", message: "Univers introuvable." };

  try {
    await prisma.client.create({
      data: {
        id: randomUUID(),
        worldKey,
        name: text(formData, "name"),
        legalName: optionalText(formData, "legalName"),
        email: optionalText(formData, "email"),
        phone: optionalText(formData, "phone"),
        address: optionalText(formData, "address"),
        website: optionalText(formData, "website"),
        logoUrl: optionalText(formData, "logoUrl"),
        industry: optionalText(formData, "industry"),
        notes: optionalText(formData, "notes"),
        accountManagerId: optionalText(formData, "accountManagerId"),
        commercialOwnerId: optionalText(formData, "commercialOwnerId"),
        teamId: optionalText(formData, "teamId"),
        status: "ACTIVE",
        version: 1,
        createdAt: context.clock.now(),
        updatedAt: context.clock.now(),
      },
    });
  } catch {
    return { status: "error", message: "Impossible de créer ce client." };
  }

  revalidatePath("/workspace/clients");
  revalidatePath("/workspace/billing");
  return { status: "success", message: "Le compte client a été créé." };
}

export async function addClientContactAction(
  _state: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  void _state;
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !canManageClients(context.actor.role)) {
    return { status: "error", message: "Action non autorisée." };
  }

  const clientId = text(formData, "clientId");
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return { status: "error", message: "Client introuvable." };

  try {
    if (formData.get("isPrimary") === "on") {
      await prisma.clientContact.updateMany({
        where: { clientId },
        data: { isPrimary: false },
      });
    }
    await prisma.clientContact.create({
      data: {
        clientId,
        name: text(formData, "name"),
        role: optionalText(formData, "role"),
        email: optionalText(formData, "email"),
        phone: optionalText(formData, "phone"),
        isPrimary: formData.get("isPrimary") === "on",
      },
    });
  } catch {
    return { status: "error", message: "Impossible d'ajouter ce contact." };
  }

  revalidatePath("/workspace/clients");
  return { status: "success", message: "Le contact a été ajouté." };
}

export async function archiveProfessionalClientAction(formData: FormData) {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !canManageClients(context.actor.role)) return;
  await prisma.client.update({
    where: { id: text(formData, "clientId") },
    data: {
      status: "ARCHIVED",
      version: { increment: 1 },
      updatedAt: context.clock.now(),
    },
  });
  revalidatePath("/workspace/clients");
  revalidatePath("/workspace/billing");
}
