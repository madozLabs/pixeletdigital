import type { PublishedServiceFamilyProjection } from "@/modules/content/application/public/list-published-service-families";
import type { PublishedServiceProjection } from "@/modules/content/application/public/list-published-services";

const UNGROUPED_LABEL = "Autres services";

export type ServiceGroup = Readonly<{
  label: string;
  services: readonly PublishedServiceProjection[];
}>;

export function groupServicesByFamily(
  services: readonly PublishedServiceProjection[],
  families: readonly PublishedServiceFamilyProjection[],
): readonly ServiceGroup[] {
  const familyById = new Map(families.map((family) => [family.id, family]));
  const byFamilyId = new Map<string, PublishedServiceProjection[]>();
  const ungrouped: PublishedServiceProjection[] = [];

  for (const service of services) {
    const family = service.familyId ? familyById.get(service.familyId) : null;
    if (!family) {
      ungrouped.push(service);
      continue;
    }
    const bucket = byFamilyId.get(family.id) ?? [];
    bucket.push(service);
    byFamilyId.set(family.id, bucket);
  }

  const groups: ServiceGroup[] = [...families]
    .sort((a, b) => a.order - b.order)
    .filter((family) => (byFamilyId.get(family.id)?.length ?? 0) > 0)
    .map((family) => ({
      label: family.label,
      services: byFamilyId.get(family.id) ?? [],
    }));

  if (ungrouped.length > 0) {
    groups.push({ label: UNGROUPED_LABEL, services: ungrouped });
  }

  return groups;
}
