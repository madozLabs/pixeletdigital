"use server";

import { revalidatePath } from "next/cache";

import {
  archiveExpenseCategory,
  createExpenseCategory,
} from "@/modules/finance/application/expense-category-use-cases";
import {
  deleteExpense,
  recordExpense,
} from "@/modules/finance/application/expense-use-cases";
import {
  deleteRevenueEntry,
  recordRevenueEntry,
} from "@/modules/finance/application/revenue-entry-use-cases";
import { PrismaExpenseCategoryRepository } from "@/modules/finance/infrastructure/prisma-expense-category-repository";
import { PrismaExpenseRepository } from "@/modules/finance/infrastructure/prisma-expense-repository";
import { PrismaRevenueEntryRepository } from "@/modules/finance/infrastructure/prisma-revenue-entry-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";
import { prisma } from "@/infrastructure/shared/prisma-client";
import {
  recordAuditEvent,
  type RecordableAuditAction,
  type RecordableAuditTargetType,
} from "@/modules/audit/infrastructure/record-audit-event";
import type { RequestContext } from "@/shared/request-context";

import type { ActionState } from "../_components/feedback";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import { xofToCents } from "../billing/_lib/money";

function toActionState(
  result: Readonly<{ ok: true } | { ok: false; error: { message: string } }>,
  successMessage: string,
): ActionState {
  if (result.ok) return { status: "success", message: successMessage };
  return { status: "error", message: result.error.message };
}

function auditFinanceEvent(
  context: RequestContext,
  action: RecordableAuditAction,
  targetType: RecordableAuditTargetType,
  target: Readonly<{ id: string; worldKey: string }>,
): Promise<void> {
  return recordAuditEvent(prisma, {
    action,
    targetType,
    targetId: target.id,
    actorId: context.actor?.id ?? "unknown",
    correlationId: context.correlationId,
    originChannel: context.origin.channel,
    worldKey: target.worldKey,
    occurredAt: context.clock.now(),
  });
}

function worldDependencies() {
  return { worlds: new PrismaWorldRepository(prisma) };
}

export async function createExpenseCategoryAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const result = await createExpenseCategory(
    { categories: new PrismaExpenseCategoryRepository(prisma) },
    context,
    { label: String(formData.get("label") ?? "") },
  );
  if (!result.ok) console.error("createExpenseCategory failed", result.error);
  revalidatePath("/workspace/finances");
  return toActionState(result, "Catégorie créée.");
}

export async function archiveExpenseCategoryAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const result = await archiveExpenseCategory(
    { categories: new PrismaExpenseCategoryRepository(prisma) },
    context,
    {
      id: String(formData.get("id")),
      expectedVersion: Number(formData.get("expectedVersion")),
    },
  );
  if (!result.ok) console.error("archiveExpenseCategory failed", result.error);
  revalidatePath("/workspace/finances");
  return toActionState(result, "Catégorie archivée.");
}

export async function recordExpenseAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const expenseDateRaw = String(formData.get("expenseDate") ?? "").trim();
  const result = await recordExpense(
    {
      expenses: new PrismaExpenseRepository(prisma),
      categories: new PrismaExpenseCategoryRepository(prisma),
      ...worldDependencies(),
    },
    context,
    {
      worldKey: String(formData.get("worldKey")),
      categoryId: String(formData.get("categoryId")),
      label: String(formData.get("label") ?? ""),
      amountCents: xofToCents(formData.get("amount")),
      expenseDate: expenseDateRaw ? new Date(expenseDateRaw) : context.clock.now(),
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  );
  if (!result.ok) {
    console.error("recordExpense failed", result.error);
  } else {
    await auditFinanceEvent(context, "FINANCE_EXPENSE_RECORDED", "EXPENSE", result.value);
  }
  revalidatePath("/workspace/finances");
  return toActionState(result, "Dépense enregistrée.");
}

export async function deleteExpenseAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const result = await deleteExpense(
    {
      expenses: new PrismaExpenseRepository(prisma),
      categories: new PrismaExpenseCategoryRepository(prisma),
      ...worldDependencies(),
    },
    context,
    { id: String(formData.get("id")) },
  );
  if (!result.ok) {
    console.error("deleteExpense failed", result.error);
  } else {
    await auditFinanceEvent(context, "FINANCE_EXPENSE_DELETED", "EXPENSE", result.value);
  }
  revalidatePath("/workspace/finances");
  return toActionState(result, "Dépense supprimée.");
}

export async function recordRevenueEntryAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const revenueDateRaw = String(formData.get("revenueDate") ?? "").trim();
  const result = await recordRevenueEntry(
    {
      revenueEntries: new PrismaRevenueEntryRepository(prisma),
      ...worldDependencies(),
    },
    context,
    {
      worldKey: String(formData.get("worldKey")),
      label: String(formData.get("label") ?? ""),
      amountCents: xofToCents(formData.get("amount")),
      revenueDate: revenueDateRaw ? new Date(revenueDateRaw) : context.clock.now(),
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  );
  if (!result.ok) {
    console.error("recordRevenueEntry failed", result.error);
  } else {
    await auditFinanceEvent(
      context,
      "FINANCE_REVENUE_RECORDED",
      "REVENUE_ENTRY",
      result.value,
    );
  }
  revalidatePath("/workspace/finances");
  return toActionState(result, "Recette enregistrée.");
}

export async function deleteRevenueEntryAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await getWorkspaceRequestContext();
  if (!context) return { status: "error", message: "Session expirée." };

  const result = await deleteRevenueEntry(
    {
      revenueEntries: new PrismaRevenueEntryRepository(prisma),
      ...worldDependencies(),
    },
    context,
    { id: String(formData.get("id")) },
  );
  if (!result.ok) {
    console.error("deleteRevenueEntry failed", result.error);
  } else {
    await auditFinanceEvent(
      context,
      "FINANCE_REVENUE_DELETED",
      "REVENUE_ENTRY",
      result.value,
    );
  }
  revalidatePath("/workspace/finances");
  return toActionState(result, "Recette supprimée.");
}
