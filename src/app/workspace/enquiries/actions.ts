"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/infrastructure/shared/prisma-client";
import {
  addLeadNote,
  assignLead,
  completeNextAction,
  setNextAction,
  updateLeadStatus,
} from "@/modules/leads/application/lead-use-cases";
import { PrismaLeadRepository } from "@/modules/leads/infrastructure/prisma-lead-repository";

import { getWorkspaceRequestContext } from "../get-workspace-context";

function dependencies() {
  return { leads: new PrismaLeadRepository(prisma) };
}

function revalidate(worldKey: string, leadId: string) {
  revalidatePath(`/workspace/enquiries?world=${worldKey}&lead=${leadId}`);
}

export async function updateLeadStatusAction(
  formData: FormData,
): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

  const worldKey = String(formData.get("worldKey"));
  const leadId = String(formData.get("leadId"));
  const result = await updateLeadStatus(dependencies(), context, {
    id: leadId,
    expectedVersion: Number(formData.get("expectedVersion")),
    status: String(formData.get("status")),
    closedOutcome: String(formData.get("closedOutcome") ?? "").trim() || null,
  });
  if (!result.ok) console.error("updateLeadStatus failed", result.error);
  revalidate(worldKey, leadId);
}

export async function assignLeadAction(formData: FormData): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

  const worldKey = String(formData.get("worldKey"));
  const leadId = String(formData.get("leadId"));
  const result = await assignLead(dependencies(), context, {
    id: leadId,
    expectedVersion: Number(formData.get("expectedVersion")),
    ownerUserId: String(formData.get("ownerUserId")),
  });
  if (!result.ok) console.error("assignLead failed", result.error);
  revalidate(worldKey, leadId);
}

export async function addLeadNoteAction(formData: FormData): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

  const worldKey = String(formData.get("worldKey"));
  const leadId = String(formData.get("leadId"));
  const result = await addLeadNote(dependencies(), context, {
    leadId,
    body: String(formData.get("body")),
  });
  if (!result.ok) console.error("addLeadNote failed", result.error);
  revalidate(worldKey, leadId);
}

export async function setNextActionAction(formData: FormData): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

  const worldKey = String(formData.get("worldKey"));
  const leadId = String(formData.get("leadId"));
  const dueDateValue = String(formData.get("dueDate"));
  const result = await setNextAction(dependencies(), context, {
    leadId,
    ownerUserId: String(formData.get("ownerUserId")),
    description: String(formData.get("description")),
    dueDate: new Date(dueDateValue),
  });
  if (!result.ok) console.error("setNextAction failed", result.error);
  revalidate(worldKey, leadId);
}

export async function completeNextActionAction(
  formData: FormData,
): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

  const worldKey = String(formData.get("worldKey"));
  const leadId = String(formData.get("leadId"));
  const result = await completeNextAction(dependencies(), context, {
    leadId,
    nextActionId: String(formData.get("nextActionId")),
  });
  if (!result.ok) console.error("completeNextAction failed", result.error);
  revalidate(worldKey, leadId);
}
