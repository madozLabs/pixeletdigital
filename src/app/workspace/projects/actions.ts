"use server";

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

function mayManageProjects(role: string | null | undefined): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "WORLD_MANAGER";
}

export async function createProjectAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !mayManageProjects(context.actor.role)) {
    return {
      status: "error",
      message: "Vous n'êtes pas autorisé à créer un projet.",
    };
  }

  const worldKey = text(formData, "worldKey");
  const name = text(formData, "name");
  const clientId = text(formData, "clientId");
  if (!name || !clientId) {
    return {
      status: "error",
      message: "Le nom et le client sont requis.",
    };
  }

  try {
    requireWorldAccess(context.actor, worldKey);

    const budget = Number(formData.get("budget"));
    const startDate = optionalText(formData, "startDate");
    const dueDate = optionalText(formData, "dueDate");

    await prisma.project.create({
      data: {
        worldKey,
        clientId,
        name,
        description: optionalText(formData, "description"),
        priority: text(formData, "priority") as
          "LOW" | "NORMAL" | "HIGH" | "URGENT",
        projectManagerId: optionalText(formData, "projectManagerId"),
        teamId: optionalText(formData, "teamId"),
        budgetCents:
          Number.isFinite(budget) && budget > 0
            ? Math.round(budget * 100)
            : null,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });
    revalidatePath("/workspace/projects");
    return { status: "success", message: "Projet créé." };
  } catch (error) {
    console.error("createProject failed", error);
    return {
      status: "error",
      message: "Le projet n'a pas pu être créé. Merci de réessayer.",
    };
  }
}

export async function updateProjectAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !mayManageProjects(context.actor.role)) {
    return {
      status: "error",
      message: "Vous n'êtes pas autorisé à modifier ce projet.",
    };
  }

  const projectId = text(formData, "projectId");
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { worldKey: true, version: true },
    });
    if (!project) {
      return { status: "error", message: "Ce projet n'existe plus." };
    }
    requireWorldAccess(context.actor, project.worldKey);

    const progress = Number(formData.get("progress"));
    const expectedVersion = Number(formData.get("expectedVersion"));
    const budget = Number(formData.get("budget"));
    const updated = await prisma.project.updateMany({
      where: { id: projectId, version: expectedVersion },
      data: {
        status: text(formData, "status") as
          "PLANNED" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED",
        progress: Number.isInteger(progress)
          ? Math.min(100, Math.max(0, progress))
          : 0,
        budgetCents:
          Number.isFinite(budget) && budget > 0
            ? Math.round(budget * 100)
            : null,
        updatedAt: context.clock.now(),
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      return {
        status: "error",
        message:
          "Ce projet a été modifié par quelqu’un d’autre. Rechargez la page avant de réessayer.",
      };
    }
    revalidatePath("/workspace/projects");
    return { status: "success", message: "Projet mis à jour." };
  } catch (error) {
    console.error("updateProject failed", error);
    return {
      status: "error",
      message:
        "La mise à jour n'a pas pu être enregistrée. Merci de réessayer.",
    };
  }
}
