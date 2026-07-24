"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { addClientContact } from "@/modules/billing/application/client-contact-use-cases";
import {
  archiveClient,
  createClient,
} from "@/modules/billing/application/client-use-cases";
import { PrismaClientContactRepository } from "@/modules/billing/infrastructure/prisma-client-contact-repository";
import { PrismaClientRepository } from "@/modules/billing/infrastructure/prisma-client-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

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

function clientDependencies() {
  return {
    clients: new PrismaClientRepository(prisma),
    worlds: new PrismaWorldRepository(prisma),
  };
}

const ERROR_MESSAGE_BY_CODE: Readonly<Record<string, string>> = {
  FORBIDDEN: "Vous n'êtes pas autorisé à effectuer cette action.",
  UNAUTHENTICATED: "Votre session n'est plus valide.",
  CONFLICT: "Les données ont changé. Rechargez la page puis réessayez.",
  NOT_FOUND: "Le client est introuvable.",
};

function mapResult(
  result: Readonly<
    | { ok: true }
    | { ok: false; error: Readonly<{ code: string; message: string }> }
  >,
  successMessage: string,
): ClientActionState {
  if (result.ok) return { status: "success", message: successMessage };
  return {
    status: "error",
    message: ERROR_MESSAGE_BY_CODE[result.error.code] ?? result.error.message,
  };
}

export async function createProfessionalClientAction(
  _state: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  void _state;
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const result = await createClient(clientDependencies(), context, {
    id: randomUUID(),
    worldKey: text(formData, "worldKey"),
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
  });

  const state = mapResult(result, "Le compte client a été créé.");
  if (state.status === "success") {
    revalidatePath("/workspace/clients");
    revalidatePath("/workspace/billing");
  }
  return state;
}

export async function addClientContactAction(
  _state: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  void _state;
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const result = await addClientContact(
    {
      clients: new PrismaClientRepository(prisma),
      clientContacts: new PrismaClientContactRepository(prisma),
    },
    context,
    {
      id: randomUUID(),
      clientId: text(formData, "clientId"),
      name: text(formData, "name"),
      role: optionalText(formData, "role"),
      email: optionalText(formData, "email"),
      phone: optionalText(formData, "phone"),
      isPrimary: formData.get("isPrimary") === "on",
    },
  );

  const state = mapResult(result, "Le contact a été ajouté.");
  if (state.status === "success") revalidatePath("/workspace/clients");
  return state;
}

export async function archiveProfessionalClientAction(
  formData: FormData,
): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

  const result = await archiveClient(clientDependencies(), context, {
    id: text(formData, "clientId"),
    expectedVersion: Number(formData.get("expectedVersion")),
  });
  if (!result.ok) console.error("archiveClient failed", result.error);
  revalidatePath("/workspace/clients");
  revalidatePath("/workspace/billing");
}
