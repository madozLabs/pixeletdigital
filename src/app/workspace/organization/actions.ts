"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getWorkspaceRequestContext } from "../get-workspace-context";

export type OrganizationActionState = Readonly<{
  status: "idle" | "success" | "error";
  message?: string;
}>;

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function requireSuperAdmin(): Promise<boolean> {
  const context = await getWorkspaceRequestContext();
  return context?.actor?.role === "SUPER_ADMIN";
}

function error(message: string): OrganizationActionState {
  return { status: "error", message };
}
export async function createDepartmentAction(
  _state: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  void _state;
  if (!(await requireSuperAdmin())) return error("Action non autorisée.");
  const name = text(formData, "name");
  if (name.length < 2) return error("Le nom du département est trop court.");
  try {
    await prisma.department.create({
      data: { name, description: text(formData, "description") || null },
    });
    revalidatePath("/workspace/organization");
    return { status: "success", message: "Département créé." };
  } catch {
    return error("Ce département existe déjà ou ne peut pas être créé.");
  }
}

export async function createTeamAction(
  _state: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  void _state;
  if (!(await requireSuperAdmin())) return error("Action non autorisée.");
  const name = text(formData, "name");
  const departmentId = text(formData, "departmentId");
  if (!name || !departmentId) return error("Département et nom requis.");
  try {
    await prisma.team.create({
      data: {
        name,
        departmentId,
        description: text(formData, "description") || null,
      },
    });
    revalidatePath("/workspace/organization");
    return { status: "success", message: "Équipe créée." };
  } catch {
    return error("Cette équipe existe déjà ou ne peut pas être créée.");
  }
}

export async function createPositionAction(
  _state: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  void _state;
  if (!(await requireSuperAdmin())) return error("Action non autorisée.");
  const title = text(formData, "title");
  if (title.length < 2) return error("L'intitulé du poste est trop court.");
  try {
    await prisma.jobPosition.create({
      data: { title, description: text(formData, "description") || null },
    });
    revalidatePath("/workspace/organization");
    return { status: "success", message: "Poste créé." };
  } catch {
    return error("Ce poste existe déjà ou ne peut pas être créé.");
  }
}
export async function assignMemberAction(
  _state: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  void _state;
  if (!(await requireSuperAdmin())) return error("Action non autorisée.");
  const userId = text(formData, "userId");
  const teamId = text(formData, "teamId");
  const jobPositionId = text(formData, "jobPositionId") || null;
  if (!userId || !teamId) return error("Collaborateur et équipe requis.");
  try {
    if (formData.get("isPrimary") === "on") {
      await prisma.teamMembership.updateMany({
        where: { userId, endedAt: null, isPrimary: true },
        data: { isPrimary: false },
      });
    }
    await prisma.teamMembership.create({
      data: {
        userId,
        teamId,
        jobPositionId,
        isPrimary: formData.get("isPrimary") === "on",
      },
    });
    revalidatePath("/workspace/organization");
    return { status: "success", message: "Collaborateur affecté." };
  } catch {
    return error("Cette affectation ne peut pas être créée.");
  }
}

export async function endMembershipAction(formData: FormData): Promise<void> {
  if (!(await requireSuperAdmin())) return;
  const id = text(formData, "membershipId");
  if (!id) return;
  await prisma.teamMembership.update({
    where: { id },
    data: { endedAt: new Date(), isPrimary: false },
  });
  revalidatePath("/workspace/organization");
}
