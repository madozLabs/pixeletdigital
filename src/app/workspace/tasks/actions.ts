"use server";

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

function mayManageTasks(role: string | null | undefined): boolean {
  return role !== null && role !== undefined && role !== "READER";
}
export async function createTaskAction(formData: FormData): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !mayManageTasks(context.actor.role)) return;

  const projectId = text(formData, "projectId");
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { worldKey: true },
  });
  if (!project) return;
  requireWorldAccess(context.actor, project.worldKey);

  const estimatedHours = Number(formData.get("estimatedHours"));
  const dueDate = optionalText(formData, "dueDate");
  await prisma.task.create({
    data: {
      projectId: text(formData, "projectId"),
      parentTaskId: optionalText(formData, "parentTaskId"),
      dependencyTaskId: optionalText(formData, "dependencyTaskId"),
      title: text(formData, "title"),
      description: optionalText(formData, "description"),
      priority: text(formData, "priority") as
        "LOW" | "NORMAL" | "HIGH" | "URGENT",
      assigneeId: optionalText(formData, "assigneeId"),
      createdById: context.actor.id,
      dueDate: dueDate ? new Date(dueDate) : null,
      estimatedMinutes:
        Number.isFinite(estimatedHours) && estimatedHours > 0
          ? Math.round(estimatedHours * 60)
          : null,
    },
  });
  revalidatePath("/workspace/tasks");
}
export async function updateTaskAction(formData: FormData): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !mayManageTasks(context.actor.role)) return;

  const taskId = text(formData, "taskId");
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { project: { select: { worldKey: true } } },
  });
  if (!task) return;
  requireWorldAccess(context.actor, task.project.worldKey);

  const progress = Number(formData.get("progress"));
  const actualHours = Number(formData.get("actualHours"));
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: text(formData, "status") as
        | "BACKLOG"
        | "TODO"
        | "IN_PROGRESS"
        | "BLOCKED"
        | "REVIEW"
        | "DONE"
        | "CANCELLED",
      progress: Number.isInteger(progress)
        ? Math.min(100, Math.max(0, progress))
        : 0,
      actualMinutes:
        Number.isFinite(actualHours) && actualHours >= 0
          ? Math.round(actualHours * 60)
          : null,
    },
  });
  revalidatePath("/workspace/tasks");
}
