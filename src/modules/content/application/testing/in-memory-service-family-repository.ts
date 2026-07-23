import type { ServiceFamily } from "../../domain/service-family";
import type { ServiceFamilyRepository } from "../service-family-repository";

export class InMemoryServiceFamilyRepository implements ServiceFamilyRepository {
  readonly savedFamilies: ServiceFamily[] = [];
  private readonly familiesById = new Map<string, ServiceFamily>();

  constructor(families: readonly ServiceFamily[] = []) {
    for (const family of families) this.familiesById.set(family.id, family);
  }

  async findById(id: string): Promise<ServiceFamily | null> {
    return this.familiesById.get(id) ?? null;
  }

  async listByWorld(worldKey: string): Promise<readonly ServiceFamily[]> {
    return [...this.familiesById.values()]
      .filter((family) => family.worldKey === worldKey)
      .sort((a, b) => a.order - b.order);
  }

  async listPublishedByWorld(
    worldKey: string,
  ): Promise<readonly ServiceFamily[]> {
    return [...this.familiesById.values()]
      .filter(
        (family) =>
          family.worldKey === worldKey && family.lifecycle === "PUBLISHED",
      )
      .sort((a, b) => a.order - b.order);
  }

  async save(family: ServiceFamily): Promise<void> {
    this.savedFamilies.push(family);
    this.familiesById.set(family.id, family);
  }
}
