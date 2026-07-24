"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/infrastructure/shared/prisma-client";
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
export async function createProjectAction(formData: FormData): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !mayManageProjects(context.actor.role)) return;

  const budget = Number(formData.get("budget"));
  const startDate = optionalText(formData, "startDate");
  const dueDate = optionalText(formData, "dueDate");

  await prisma.project.create({
    data: {
      worldKey: text(formData, "worldKey"),
      clientId: text(formData, "clientId"),
      name: text(formData, "name"),
      description: optionalText(formData, "description"),
      priority: text(formData, "priority") as
        "LOW" | "NORMAL" | "HIGH" | "URGENT",
      projectManagerId: optionalText(formData, "projectManagerId"),
      teamId: optionalText(formData, "teamId"),
      budgetCents:
        Number.isFinite(budget) && budget > 0 ? Math.round(budget * 100) : null,
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });
  revalidatePath("/workspace/projects");
}
export async function updateProjectAction(formData: FormData): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !mayManageProjects(context.actor.role)) return;

  const progress = Number(formData.get("progress"));
  await prisma.project.update({
    where: { id: text(formData, "projectId") },
    data: {
      status: text(formData, "status") as
        "PLANNED" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED",
      progress: Number.isInteger(progress)
        ? Math.min(100, Math.max(0, progress))
        : 0,
      updatedAt: context.clock.now(),
    },
  });
  revalidatePath("/workspace/projects");
}
