import type {
  ExpenseCategory as PrismaExpenseCategory,
  PrismaClient,
} from "@/generated/prisma/client";

import type { ExpenseCategoryRepository } from "../application/expense-category-repository";
import {
  restoreExpenseCategory,
  type ExpenseCategory,
} from "../domain/expense-category";

export class PrismaExpenseCategoryRepository
  implements ExpenseCategoryRepository
{
  constructor(private readonly client: PrismaClient) {}

  async findById(id: string): Promise<ExpenseCategory | null> {
    const record = await this.client.expenseCategory.findUnique({
      where: { id },
    });
    return record ? toDomain(record) : null;
  }

  async findByLabel(label: string): Promise<ExpenseCategory | null> {
    const record = await this.client.expenseCategory.findUnique({
      where: { label },
    });
    return record ? toDomain(record) : null;
  }

  async listActive(): Promise<readonly ExpenseCategory[]> {
    const records = await this.client.expenseCategory.findMany({
      where: { status: "ACTIVE" },
      orderBy: { label: "asc" },
    });
    return records.map(toDomain);
  }

  async listAll(): Promise<readonly ExpenseCategory[]> {
    const records = await this.client.expenseCategory.findMany({
      orderBy: { label: "asc" },
    });
    return records.map(toDomain);
  }

  async save(category: ExpenseCategory): Promise<boolean> {
    const existing = await this.client.expenseCategory.findUnique({
      where: { id: category.id },
      select: { id: true },
    });

    if (!existing) {
      await this.client.expenseCategory.create({
        data: {
          id: category.id,
          label: category.label,
          status: category.status,
          version: category.version,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
        },
      });
      return true;
    }

    const updated = await this.client.expenseCategory.updateMany({
      where: { id: category.id, version: category.version - 1 },
      data: {
        label: category.label,
        status: category.status,
        version: category.version,
        updatedAt: category.updatedAt,
      },
    });
    return updated.count > 0;
  }
}

function toDomain(record: PrismaExpenseCategory): ExpenseCategory {
  const result = restoreExpenseCategory(record);
  if (!result.ok) {
    throw new Error(`Persisted ExpenseCategory is invalid: ${result.error.code}`);
  }
  return result.value;
}
