"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/infrastructure/shared/prisma-client";
import {
  publishService,
  rejectService,
  submitServiceForReview,
} from "@/modules/content/application/service-use-cases";
import { PrismaServiceRepository } from "@/modules/content/infrastructure/prisma-service-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

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

export async function submitForReviewAction(formData: FormData): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

  const result = await submitServiceForReview(
    dependencies(),
    context,
    transitionInput(formData),
  );
  if (!result.ok) {
    console.error("submitServiceForReview failed", result.error);
  }
  revalidatePath("/workspace/services");
}

export async function publishServiceAction(formData: FormData): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

  const result = await publishService(
    dependencies(),
    context,
    transitionInput(formData),
  );
  if (!result.ok) {
    console.error("publishService failed", result.error);
  }
  revalidatePath("/workspace/services");
}

export async function rejectServiceAction(formData: FormData): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;

  const result = await rejectService(
    dependencies(),
    context,
    transitionInput(formData),
  );
  if (!result.ok) {
    console.error("rejectService failed", result.error);
  }
  revalidatePath("/workspace/services");
}
