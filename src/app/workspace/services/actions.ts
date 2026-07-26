"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/infrastructure/shared/prisma-client";
import {
  archiveService,
  publishService,
  rejectService,
  submitServiceForReview,
} from "@/modules/content/application/service-use-cases";
import { PrismaServiceRepository } from "@/modules/content/infrastructure/prisma-service-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";
import {
  recordAuditEvent,
  type RecordableAuditAction,
} from "@/modules/audit/infrastructure/record-audit-event";
import type { RequestContext } from "@/shared/request-context";

import type { ActionState } from "../_components/feedback";
import { getWorkspaceRequestContext } from "../get-workspace-context";

function dependencies() {
  return {
    services: new PrismaServiceRepository(prisma),
    worlds: new PrismaWorldRepository(prisma),
  };
}

function transitionInput(formData: FormData) {
  return {
    id: String(formData.get("id")),
    expectedVersion: Number(formData.get("expectedVersion")),
  };
}

function toActionState(
  result: Readonly<{ ok: true } | { ok: false; error: { message: string } }>,
  successMessage: string,
): ActionState {
  if (result.ok) return { status: "success", message: successMessage };
  return { status: "error", message: result.error.message };
}

// Public pages are ISR-cached (revalidate = 60); revalidate the specific
// service page plus its world's home page (services also render there) so
// publishing/archiving is reflected immediately instead of waiting it out.
function revalidatePublicService(worldKey: string, slug: string): void {
  revalidatePath(`/services/${slug}`);
  revalidatePath(worldKey === "kwaliti-print" ? "/kwaliti-print" : "/");
}

function auditServiceTransition(
  context: RequestContext,
  action: RecordableAuditAction,
  service: Readonly<{ id: string; worldKey: string }>,
): Promise<void> {
  return recordAuditEvent(prisma, {
    action,
    targetType: "SERVICE",
    targetId: service.id,
    actorId: context.actor?.id ?? "unknown",
    correlationId: context.correlationId,
    originChannel: context.origin.channel,
    worldKey: service.worldKey,
    occurredAt: context.clock.now(),
  });
}

export async function submitForReviewAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const result = await submitServiceForReview(
    dependencies(),
    context,
    transitionInput(formData),
  );
  if (!result.ok) console.error("submitServiceForReview failed", result.error);
  revalidatePath("/workspace/services");
  return toActionState(result, "Envoyé en revue.");
}

export async function publishServiceAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const result = await publishService(
    dependencies(),
    context,
    transitionInput(formData),
  );
  if (!result.ok) {
    console.error("publishService failed", result.error);
  } else {
    revalidatePublicService(result.value.worldKey, result.value.slug);
    await auditServiceTransition(
      context,
      "CONTENT_SERVICE_PUBLISHED",
      result.value,
    );
  }
  revalidatePath("/workspace/services");
  return toActionState(result, "Service publié.");
}

export async function rejectServiceAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const result = await rejectService(
    dependencies(),
    context,
    transitionInput(formData),
  );
  if (!result.ok) console.error("rejectService failed", result.error);
  revalidatePath("/workspace/services");
  return toActionState(result, "Service renvoyé en brouillon.");
}

export async function archiveServiceAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const result = await archiveService(
    dependencies(),
    context,
    transitionInput(formData),
  );
  if (!result.ok) {
    console.error("archiveService failed", result.error);
  } else {
    revalidatePublicService(result.value.worldKey, result.value.slug);
    await auditServiceTransition(
      context,
      "CONTENT_SERVICE_ARCHIVED",
      result.value,
    );
  }
  revalidatePath("/workspace/services");
  return toActionState(result, "Service archivé.");
}
