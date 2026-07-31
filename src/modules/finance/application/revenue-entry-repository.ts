import type { RevenueEntry } from "../domain/revenue-entry";

export type ListRevenueEntriesFilter = Readonly<{
  worldKey: string;
  from?: Date | null;
  to?: Date | null;
  skip: number;
  take: number;
}>;

export interface RevenueEntryRepository {
  findById(id: string): Promise<RevenueEntry | null>;
  listByWorld(
    filter: ListRevenueEntriesFilter,
  ): Promise<readonly RevenueEntry[]>;
  countByWorld(
    filter: Omit<ListRevenueEntriesFilter, "skip" | "take">,
  ): Promise<number>;
  save(entry: RevenueEntry): Promise<void>;
  delete(id: string): Promise<void>;
}
