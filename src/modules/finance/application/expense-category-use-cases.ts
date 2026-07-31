import { randomUUID } from "node:crypto";

import type { RequestContext } from "@/shared/request-context";

import {
  archiveExpenseCategory as archiveExpenseCategoryDomain,
  createExpenseCategory as createExpenseCategoryDomain,
  type ExpenseCategory,
  type ExpenseCategoryDomainError,
  type Result,
} from "../domain/expense-category";
import type { FinanceApplicationError } from "./application-error";
import type { ExpenseCategoryRepository } from "./expense-category-repository";
import {
  forbidden,
  mayAccessFinance,
  requireActiveActor,
} from "./finance-authorization";

export type ExpenseCategoryDependencies = Readonly<{
  categories: ExpenseCategoryRepository;
}>;

export type CreateExpenseCategoryInput = Readonly<{ label: string }>;

export async function createExpenseCategory(
  dependencies: ExpenseCategoryDependencies,
  context: RequestContext,
  input: CreateExpenseCategoryInput,
): Promise<Result<ExpenseCategory, FinanceApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  if (!mayAccessFinance(actorResult.value)) return forbidden();

  const existing = await dependencies.categories.findByLabel(
    input.label.trim(),
  );
  if (existing) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: "INVALID_LABEL",
        message: "Une catégorie porte déjà ce libellé.",
      },
    };
  }

  const now = context.clock.now();
  const categoryResult = createExpenseCategoryDomain({
    id: randomUUID(),
    label: input.label,
    createdAt: now,
    updatedAt: now,
  });
  if (!categoryResult.ok) return validationFailure(categoryResult.error);

  await dependencies.categories.save(categoryResult.value);
  return { ok: true, value: categoryResult.value };
}

export async function listActiveExpenseCategories(
  dependencies: ExpenseCategoryDependencies,
  context: RequestContext,
): Promise<Result<readonly ExpenseCategory[], FinanceApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  if (!mayAccessFinance(actorResult.value)) return forbidden();

  return { ok: true, value: await dependencies.categories.listActive() };
}

// Includes archived categories -- needed to label old expenses correctly
// (archiving a category must not turn its past expenses' label into "—").
export async function listAllExpenseCategories(
  dependencies: ExpenseCategoryDependencies,
  context: RequestContext,
): Promise<Result<readonly ExpenseCategory[], FinanceApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  if (!mayAccessFinance(actorResult.value)) return forbidden();

  return { ok: true, value: await dependencies.categories.listAll() };
}

export type ArchiveExpenseCategoryInput = Readonly<{
  id: string;
  expectedVersion: number;
}>;

export async function archiveExpenseCategory(
  dependencies: ExpenseCategoryDependencies,
  context: RequestContext,
  input: ArchiveExpenseCategoryInput,
): Promise<Result<ExpenseCategory, FinanceApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  if (!mayAccessFinance(actorResult.value)) return forbidden();

  const category = await dependencies.categories.findById(input.id);
  if (!category) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Category was not found." },
    };
  }
  if (category.version !== input.expectedVersion) {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "La catégorie a changé entre-temps.",
      },
    };
  }

  const archived = archiveExpenseCategoryDomain(category, context.clock.now());
  if (!archived.ok) return validationFailure(archived.error);

  const saved = await dependencies.categories.save(archived.value);
  if (!saved) {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "La catégorie a changé entre-temps.",
      },
    };
  }
  return { ok: true, value: archived.value };
}

function validationFailure(
  error: ExpenseCategoryDomainError,
): Result<never, FinanceApplicationError> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      validationCode: error.code,
      message: error.message,
    },
  };
}
