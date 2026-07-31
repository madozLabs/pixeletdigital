import type { Expense as PrismaExpense, PrismaClient } from "@/generated/prisma/client";

import type {
  ExpenseRepository,
  ListExpensesFilter,
} from "../application/expense-repository";
import { restoreExpense, type Expense } from "../domain/expense";

export class PrismaExpenseRepository implements ExpenseRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(id: string): Promise<Expense | null> {
    const record = await this.client.expense.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }

  async listByWorld(filter: ListExpensesFilter): Promise<readonly Expense[]> {
    const records = await this.client.expense.findMany({
      where: whereFor(filter),
      orderBy: { expenseDate: "desc" },
      skip: filter.skip,
      take: filter.take,
    });
    return records.map(toDomain);
  }

  async countByWorld(
    filter: Omit<ListExpensesFilter, "skip" | "take">,
  ): Promise<number> {
    return this.client.expense.count({ where: whereFor(filter) });
  }

  async save(expense: Expense): Promise<void> {
    await this.client.expense.create({
      data: {
        id: expense.id,
        worldKey: expense.worldKey,
        categoryId: expense.categoryId,
        label: expense.label,
        amountCents: expense.amountCents,
        expenseDate: expense.expenseDate,
        notes: expense.notes,
        createdById: expense.createdById,
        createdAt: expense.createdAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.client.expense.delete({ where: { id } });
  }
}

function whereFor(
  filter: Readonly<{ worldKey: string; from?: Date | null; to?: Date | null }>,
) {
  return {
    worldKey: filter.worldKey,
    ...(filter.from || filter.to
      ? {
          expenseDate: {
            ...(filter.from ? { gte: filter.from } : {}),
            ...(filter.to ? { lte: filter.to } : {}),
          },
        }
      : {}),
  };
}

function toDomain(record: PrismaExpense): Expense {
  const result = restoreExpense(record);
  if (!result.ok) {
    throw new Error(`Persisted Expense is invalid: ${result.error.code}`);
  }
  return result.value;
}
