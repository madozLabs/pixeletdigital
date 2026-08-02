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

function mayManageTasks(role: string | null | undefined): boolean {
  return role !== null && role !== undefined && role !== "READER";
}

// E3 (audit éditorial/tâches) : décision produit tranchée -- blocage
// strict. Une tâche ne peut passer DONE tant que sa dépendance ne l'est
// pas elle-même ; sinon la dépendance n'était qu'une information
// décorative jamais réellement appliquée.
async function dependencyBlockingDone(
  dependencyTaskId: string | null,
): Promise<string | null> {
  if (!dependencyTaskId) return null;
  const dependency = await prisma.task.findUnique({
    where: { id: dependencyTaskId },
    select: { title: true, status: true },
  });
  if (!dependency || dependency.status === "DONE") return null;
  return `Impossible de terminer : sa dépendance « ${dependency.title} » n'est pas encore terminée.`;
}

export async function createTaskAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !mayManageTasks(context.actor.role)) {
    return {
      status: "error",
      message: "Vous n'êtes pas autorisé à créer une tâche.",
    };
  }

  const title = text(formData, "title");
  if (!title) {
    return { status: "error", message: "Le titre est requis." };
  }

  const projectId = text(formData, "projectId");
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { worldKey: true },
    });
    if (!project) {
      return { status: "error", message: "Ce projet n'existe plus." };
    }
    requireWorldAccess(context.actor, project.worldKey);

    const estimatedHours = Number(formData.get("estimatedHours"));
    const dueDate = optionalText(formData, "dueDate");
    await prisma.task.create({
      data: {
        projectId,
        parentTaskId: optionalText(formData, "parentTaskId"),
        dependencyTaskId: optionalText(formData, "dependencyTaskId"),
        title,
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
    return { status: "success", message: "Tâche créée." };
  } catch (error) {
    console.error("createTask failed", error);
    return {
      status: "error",
      message: "La tâche n'a pas pu être créée. Merci de réessayer.",
    };
  }
}

const TASK_STATUSES = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "REVIEW",
  "DONE",
  "CANCELLED",
] as const;
type TaskStatus = (typeof TASK_STATUSES)[number];

function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value);
}

export type MoveTaskResult = Readonly<
  { ok: true } | { ok: false; message: string }
>;

// Drag-and-drop column move: only touches status + position, never
// progress/actualMinutes, so it can't clobber the values entered through
// the manual edit form below. Not a <form> action -- called directly from
// the board's drag handler, so it returns a result object instead of the
// ActionState shape (which is tied to useActionState/<form>).
export async function moveTaskAction(
  taskId: string,
  status: string,
  expectedVersion: number,
): Promise<MoveTaskResult> {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !mayManageTasks(context.actor.role)) {
    return {
      ok: false,
      message: "Vous n'êtes pas autorisé à déplacer cette tâche.",
    };
  }
  if (!isTaskStatus(status)) {
    return { ok: false, message: "Statut de tâche invalide." };
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        projectId: true,
        dependencyTaskId: true,
        project: { select: { worldKey: true } },
      },
    });
    if (!task) return { ok: false, message: "Cette tâche n'existe plus." };
    requireWorldAccess(context.actor, task.project.worldKey);

    if (status === "DONE") {
      const blocked = await dependencyBlockingDone(task.dependencyTaskId);
      if (blocked) return { ok: false, message: blocked };
    }

    const last = await prisma.task.findFirst({
      where: { projectId: task.projectId, status },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const moved = await prisma.task.updateMany({
      where: { id: taskId, version: expectedVersion },
      data: {
        status,
        position: (last?.position ?? -1) + 1,
        version: { increment: 1 },
      },
    });
    if (moved.count === 0) {
      return {
        ok: false,
        message:
          "Le déplacement n'a pas pu être enregistré : la tâche a changé entre-temps.",
      };
    }
    revalidatePath("/workspace/tasks");
    return { ok: true };
  } catch (error) {
    console.error("moveTask failed", error);
    return {
      ok: false,
      message:
        "Le déplacement n'a pas pu être enregistré (la tâche a peut-être changé entre-temps).",
    };
  }
}

const TASK_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
type TaskPriority = (typeof TASK_PRIORITIES)[number];

function isTaskPriority(value: string): value is TaskPriority {
  return (TASK_PRIORITIES as readonly string[]).includes(value);
}

// Separate from updateTaskAction (status/progress/hours, driven by the
// board's quick-edit form) -- this covers the fields that were only ever
// settable at creation time (title, description, priority, assignee, due
// date, estimate, parent/dependency), which had no edit path at all before.
export async function editTaskDetailsAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !mayManageTasks(context.actor.role)) {
    return {
      status: "error",
      message: "Vous n'êtes pas autorisé à modifier cette tâche.",
    };
  }

  const taskId = text(formData, "taskId");
  const title = text(formData, "title");
  if (!title) {
    return { status: "error", message: "Le titre est requis." };
  }
  const priority = text(formData, "priority");
  if (!isTaskPriority(priority)) {
    return { status: "error", message: "Priorité invalide." };
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        projectId: true,
        parentTaskId: true,
        project: { select: { worldKey: true } },
      },
    });
    if (!task) {
      return { status: "error", message: "Cette tâche n'existe plus." };
    }
    requireWorldAccess(context.actor, task.project.worldKey);

    const expectedVersion = Number(formData.get("expectedVersion"));
    const parentTaskId = optionalText(formData, "parentTaskId");
    if (parentTaskId === taskId) {
      return {
        status: "error",
        message: "Une tâche ne peut pas être sa propre sous-tâche.",
      };
    }
    const dependencyTaskId = optionalText(formData, "dependencyTaskId");
    if (dependencyTaskId === taskId) {
      return {
        status: "error",
        message: "Une tâche ne peut pas dépendre d'elle-même.",
      };
    }
    const estimatedHours = Number(formData.get("estimatedHours"));
    const dueDate = optionalText(formData, "dueDate");

    const updated = await prisma.task.updateMany({
      where: { id: taskId, version: expectedVersion },
      data: {
        title,
        description: optionalText(formData, "description"),
        priority,
        assigneeId: optionalText(formData, "assigneeId"),
        parentTaskId,
        dependencyTaskId,
        dueDate: dueDate ? new Date(dueDate) : null,
        estimatedMinutes:
          Number.isFinite(estimatedHours) && estimatedHours > 0
            ? Math.round(estimatedHours * 60)
            : null,
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      return {
        status: "error",
        message: "Cette tâche a changé depuis son dernier chargement.",
      };
    }
    revalidatePath("/workspace/tasks");
    return { status: "success", message: "Tâche modifiée." };
  } catch (error) {
    console.error("editTaskDetails failed", error);
    return {
      status: "error",
      message: "La modification n'a pas pu être enregistrée. Merci de réessayer.",
    };
  }
}

export async function updateTaskAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context?.actor || !mayManageTasks(context.actor.role)) {
    return {
      status: "error",
      message: "Vous n'êtes pas autorisé à modifier cette tâche.",
    };
  }

  const taskId = text(formData, "taskId");
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        dependencyTaskId: true,
        project: { select: { worldKey: true } },
      },
    });
    if (!task) {
      return { status: "error", message: "Cette tâche n'existe plus." };
    }
    requireWorldAccess(context.actor, task.project.worldKey);

    const expectedVersion = Number(formData.get("expectedVersion"));
    const progress = Number(formData.get("progress"));
    const actualHours = Number(formData.get("actualHours"));
    const status = text(formData, "status") as
      | "BACKLOG"
      | "TODO"
      | "IN_PROGRESS"
      | "BLOCKED"
      | "REVIEW"
      | "DONE"
      | "CANCELLED";

    if (status === "DONE") {
      const blocked = await dependencyBlockingDone(task.dependencyTaskId);
      if (blocked) return { status: "error", message: blocked };
    }

    const updated = await prisma.task.updateMany({
      where: { id: taskId, version: expectedVersion },
      data: {
        status,
        progress: Number.isInteger(progress)
          ? Math.min(100, Math.max(0, progress))
          : 0,
        actualMinutes:
          Number.isFinite(actualHours) && actualHours >= 0
            ? Math.round(actualHours * 60)
            : null,
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      return {
        status: "error",
        message: "Cette tâche a changé depuis son dernier chargement.",
      };
    }
    revalidatePath("/workspace/tasks");
    return { status: "success", message: "Tâche mise à jour." };
  } catch (error) {
    console.error("updateTask failed", error);
    return {
      status: "error",
      message:
        "La mise à jour n'a pas pu être enregistrée. Merci de réessayer.",
    };
  }
}
