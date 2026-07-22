import type { Service } from "../../domain/service";
import type { ServiceRepository } from "../service-repository";

export class InMemoryServiceRepository implements ServiceRepository {
  readonly savedServices: Service[] = [];
  readonly foundIds: string[] = [];
  private readonly servicesById = new Map<string, Service>();

  constructor(services: readonly Service[] = []) {
    for (const service of services) this.servicesById.set(service.id, service);
  }

  async findById(id: string): Promise<Service | null> {
    this.foundIds.push(id);
    return this.servicesById.get(id) ?? null;
  }

  async listByWorld(worldKey: string): Promise<readonly Service[]> {
    return [...this.servicesById.values()].filter(
      (service) => service.worldKey === worldKey,
    );
  }

  async listApprovedCurrentByWorld(
    worldKey: string,
  ): Promise<readonly Service[]> {
    return [...this.servicesById.values()].filter(
      (service) =>
        service.worldKey === worldKey &&
        service.lifecycle === "PUBLISHED" &&
        service.availabilityStatus === "APPROVED_CURRENT",
    );
  }

  async findPublishedByWorldAndSlug(
    worldKey: string,
    slug: string,
  ): Promise<Service | null> {
    for (const service of this.servicesById.values()) {
      if (
        service.worldKey === worldKey &&
        service.slug === slug &&
        service.lifecycle === "PUBLISHED" &&
        service.availabilityStatus === "APPROVED_CURRENT"
      ) {
        return service;
      }
    }
    return null;
  }

  async save(service: Service): Promise<void> {
    this.savedServices.push(service);
    this.servicesById.set(service.id, service);
  }
}
