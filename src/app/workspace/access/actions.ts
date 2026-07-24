"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { prisma } from "@/infrastructure/shared/prisma-client";
import {
  activateUser,
  assignRoleScope,
  createEmployee,
  deactivateUser,
  revokeRoleScope,
} from "@/modules/access/application/access-administration";
import { PrismaAccessAdministrationStore } from "@/modules/access/infrastructure/prisma-access-administration";
import { ScryptPasswordHasher } from "@/modules/access/infrastructure/scrypt-password-hasher";

import { getWorkspaceRequestContext } from "../get-workspace-context";

export type AccessActionState = Readonly<{
  status: "idle" | "success" | "error";
  message?: string;
}>;

function dependencies() {
  const store = new PrismaAccessAdministrationStore(prisma);
  return {
    reader: store,
    transaction: store,
    employeePolicy: {
      allowedDomain: process.env.EMPLOYEE_EMAIL_DOMAIN ?? "pixeldigital.local",
    },
    passwordHasher: new ScryptPasswordHasher(),
  };
}
function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function mapResult(
  result: Readonly<
    | { ok: true }
    | { ok: false; error: Readonly<{ code: string; message: string }> }
  >,
  successMessage: string,
): AccessActionState {
  if (result.ok) return { status: "success", message: successMessage };
  const messageByCode: Readonly<Record<string, string>> = {
    FORBIDDEN: "Vous n'êtes pas autorisé à effectuer cette action.",
    UNAUTHENTICATED: "Votre session n'est plus valide.",
    CONFLICT: "Les données ont changé. Rechargez la page puis réessayez.",
    NOT_FOUND: "La personne ou l'affectation est introuvable.",
    VALIDATION_ERROR: result.error.message,
    DEPENDENCY_UNAVAILABLE: "Le service est momentanément indisponible.",
  };
  return {
    status: "error",
    message: messageByCode[result.error.code] ?? "L'action a échoué.",
  };
}

export async function createEmployeeAction(
  _state: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  void _state;
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };
  const scopeType = text(formData, "scopeType");
  const worldKey = text(formData, "worldKey");
  const result = await createEmployee(dependencies(), context, {
    userId: randomUUID(),
    displayName: text(formData, "displayName"),
    email: text(formData, "email"),
    authAccountId: randomUUID(),
    provider: "credentials",
    providerAccountId: text(formData, "email").toLowerCase(),
    password: text(formData, "password"),
    assignmentId: randomUUID(),
    role: text(formData, "role"),
    scope:
      scopeType === "GLOBAL" ? { type: "GLOBAL" } : { type: "WORLD", worldKey },
    validFrom: context.clock.now(),
    confirmed: formData.get("confirmed") === "on",
    auditEventId: randomUUID(),
  });
  const state = mapResult(result, "Le profil a été créé.");
  if (state.status === "success") revalidatePath("/workspace/access");
  return state;
}

export async function setUserStatusAction(
  _state: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  void _state;
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };
  const input = {
    targetUserId: text(formData, "userId"),
    confirmed: true,
    auditEventId: randomUUID(),
  };
  const result =
    text(formData, "status") === "ACTIVE"
      ? await activateUser(dependencies(), context, input)
      : await deactivateUser(dependencies(), context, input);
  const state = mapResult(result, "Le statut du profil a été mis à jour.");
  if (state.status === "success") revalidatePath("/workspace/access");
  return state;
}
export async function assignRoleAction(
  _state: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  void _state;
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };
  const scopeType = text(formData, "scopeType");
  const result = await assignRoleScope(dependencies(), context, {
    assignmentId: randomUUID(),
    targetUserId: text(formData, "userId"),
    role: text(formData, "role"),
    scope:
      scopeType === "GLOBAL"
        ? { type: "GLOBAL" }
        : { type: "WORLD", worldKey: text(formData, "worldKey") },
    validFrom: context.clock.now(),
    confirmed: formData.get("confirmed") === "on",
    auditEventId: randomUUID(),
  });
  const state = mapResult(result, "Le rôle a été attribué.");
  if (state.status === "success") revalidatePath("/workspace/access");
  return state;
}

export async function revokeRoleAction(
  _state: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  void _state;
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };
  const result = await revokeRoleScope(dependencies(), context, {
    assignmentId: text(formData, "assignmentId"),
    confirmed: true,
    auditEventId: randomUUID(),
  });
  const state = mapResult(result, "Le rôle a été révoqué.");
  if (state.status === "success") revalidatePath("/workspace/access");
  return state;
}
