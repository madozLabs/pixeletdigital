import { randomUUID } from "node:crypto";

import { parseWorldKey } from "@/modules/worlds/domain/world";
import type { WorldRepository } from "@/modules/worlds/application/world-repository";
import type { RequestContext } from "@/shared/request-context";

import {
  recordExpense as recordExpenseDomain,
  type Expense,
  type ExpenseDomainError,
  type Result,
} from "../domain/expense";
import type { FinanceApplicationError } from "./application-error";
import type {
  ExpenseRepository,
  ListExpensesFilter,
} from "./expense-repository";
import type { ExpenseCategoryRepository } from "./expense-category-repository";
import {
  forbidden,
  hasWorldScope,
  mayAccessFinance,
  requireActiveActor,
} from "./finance-authorization";

export type ExpenseDependencies = Readonly<{
  expenses: ExpenseRepository;
  categories: ExpenseCategoryRepository;
  worlds: WorldRepository;
}>;

export type RecordExpenseInput = Readonly<{
  worldKey: string;
  categoryId: string;
  label: string;
  amountCents: number;
  expenseDate: Date;
  notes?: string | null;
}>;

export async function recordExpense(
  dependencies: ExpenseDependencies,
  context: RequestContext,
  input: RecordExpenseInput,
): Promise<Result<Expense, FinanceApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: "INVALID_WORLD_KEY",
        message: worldKeyResult.error.message,
      },
    };
  }
  if (!mayAccessFinance(actor) || !hasWorldScope(actor, worldKeyResult.value)) {
    return forbidden();
  }

  const world = await dependencies.worlds.findByKey(worldKeyResult.value);
  if (!world) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "World was not found." },
    };
  }

  const category = await dependencies.categories.findById(input.categoryId);
  if (!category || category.status !== "ACTIVE") {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: "INVALID_CATEGORY_ID",
        message: "Cette catégorie n'existe pas ou a été archivée.",
      },
    };
  }

  const now = context.clock.now();
  const expenseResult = recordExpenseDomain({
    id: randomUUID(),
    worldKey: world.key,
    categoryId: category.id,
    label: input.label,
    amountCents: input.amountCents,
    expenseDate: input.expenseDate,
    notes: input.notes,
    createdById: actor.id,
    createdAt: now,
  });
  if (!expenseResult.ok) return validationFailure(expenseResult.error);

  await dependencies.expenses.save(expenseResult.value);
  return { ok: true, value: expenseResult.value };
}

export type ListExpensesInput = ListExpensesFilter;

export async function listExpensesByWorld(
  dependencies: ExpenseDependencies,
  context: RequestContext,
  input: ListExpensesInput,
): Promise<
  Result<
    Readonly<{ items: readonly Expense[]; total: number }>,
    FinanceApplicationError
  >
> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  if (
    !mayAccessFinance(actorResult.value) ||
    !hasWorldScope(actorResult.value, input.worldKey)
  ) {
    return forbidden();
  }

  const [items, total] = await Promise.all([
    dependencies.expenses.listByWorld(input),
    dependencies.expenses.countByWorld(input),
  ]);
  return { ok: true, value: { items, total } };
}

export type DeleteExpenseInput = Readonly<{ id: string }>;

export async function deleteExpense(
  dependencies: ExpenseDependencies,
  context: RequestContext,
  input: DeleteExpenseInput,
): Promise<Result<Expense, FinanceApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

  const expense = await dependencies.expenses.findById(input.id);
  if (!expense) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Expense was not found." },
    };
  }
  if (
    !mayAccessFinance(actorResult.value) ||
    !hasWorldScope(actorResult.value, expense.worldKey)
  ) {
    return forbidden();
  }

  await dependencies.expenses.delete(input.id);
  return { ok: true, value: expense };
}

function validationFailure(
  error: ExpenseDomainError,
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
