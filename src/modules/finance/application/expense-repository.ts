import type { Expense } from "../domain/expense";

export type ListExpensesFilter = Readonly<{
  worldKey: string;
  from?: Date | null;
  to?: Date | null;
  skip: number;
  take: number;
}>;

export interface ExpenseRepository {
  findById(id: string): Promise<Expense | null>;
  listByWorld(filter: ListExpensesFilter): Promise<readonly Expense[]>;
  countByWorld(
    filter: Omit<ListExpensesFilter, "skip" | "take">,
  ): Promise<number>;
  save(expense: Expense): Promise<void>;
  delete(id: string): Promise<void>;
}
