import type { ExpenseCategory } from "../domain/expense-category";

export interface ExpenseCategoryRepository {
  findById(id: string): Promise<ExpenseCategory | null>;
  findByLabel(label: string): Promise<ExpenseCategory | null>;
  listActive(): Promise<readonly ExpenseCategory[]>;
  listAll(): Promise<readonly ExpenseCategory[]>;
  /**
   * Creates a new category, or applies an update guarded by the version the
   * caller last read (category.version - 1). Returns false instead of
   * throwing when an update loses that race.
   */
  save(category: ExpenseCategory): Promise<boolean>;
}
