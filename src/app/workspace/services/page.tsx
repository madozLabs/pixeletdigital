import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { listServiceFamilies } from "@/modules/content/application/service-family-use-cases";
import { listServicesByWorld } from "@/modules/content/application/service-use-cases";
import type { Service } from "@/modules/content/domain/service";
import { PrismaServiceFamilyRepository } from "@/modules/content/infrastructure/prisma-service-family-repository";
import { PrismaServiceRepository } from "@/modules/content/infrastructure/prisma-service-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { LifecycleBadge } from "../_components/status-badge";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import { ServiceLifecycleActions } from "./service-forms";

const WORLDS = [
  { key: "pixel-digital", label: "Pixel&Digital" },
  { key: "kwaliti-print", label: "Kwaliti Print" },
];

const UNGROUPED_TAB_ID = "autres";

const AVAILABILITY_LABEL: Readonly<Record<string, string>> = {
  CANDIDATE: "Candidat",
  CURRENT_STATED: "Annoncé",
  APPROVED_CURRENT: "Approuvé",
  FUTURE_ONLY: "À venir",
  WITHDRAWN: "Retiré",
};
const AVAILABILITY_TONE: Readonly<Record<string, string>> = {
  CANDIDATE: "neutral",
  CURRENT_STATED: "scheduled",
  APPROVED_CURRENT: "positive",
  FUTURE_ONLY: "warning",
  WITHDRAWN: "cancelled",
};

export default async function WorkspaceServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ world?: string; family?: string }>;
}) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");

  const { world, family } = await searchParams;
  const worldKey = world ?? WORLDS[0]!.key;

  const deps = {
    services: new PrismaServiceRepository(prisma),
    families: new PrismaServiceFamilyRepository(prisma),
    worlds: new PrismaWorldRepository(prisma),
  };

  const [servicesResult, familiesResult] = await Promise.all([
    listServicesByWorld(deps, context, { worldKey }),
    listServiceFamilies(deps, context, { worldKey }),
  ]);

  if (!servicesResult.ok) {
    return (
      <>
        <h1 className="admin-content__title">Services</h1>
        <p role="alert">{servicesResult.error.message}</p>
      </>
    );
  }
  if (!familiesResult.ok) {
    return (
      <>
        <h1 className="admin-content__title">Services</h1>
        <p role="alert">{familiesResult.error.message}</p>
      </>
    );
  }
  const totalServices = servicesResult.value.length;

  const families = [...familiesResult.value].sort((a, b) => a.order - b.order);
  const byFamily = new Map<string, Service[]>();
  const ungrouped: Service[] = [];
  for (const service of servicesResult.value) {
    if (!service.familyId) {
      ungrouped.push(service);
      continue;
    }
    const bucket = byFamily.get(service.familyId) ?? [];
    bucket.push(service);
    byFamily.set(service.familyId, bucket);
  }

  const tabs = [
    ...families.map((f) => ({
      id: f.id,
      label: f.label,
      services: byFamily.get(f.id) ?? [],
    })),
    ...(ungrouped.length > 0
      ? [{ id: UNGROUPED_TAB_ID, label: "Autres", services: ungrouped }]
      : []),
  ];

  const activeTabId = family ?? tabs[0]?.id;
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-content__title">Services</h1>
          <p className="admin-content__lede">
            Catalogue public par famille, cycle de vie et disponibilité.
          </p>
        </div>
        <span className="admin-metric">
          {totalServices} service{totalServices > 1 ? "s" : ""}
        </span>
      </div>

      {tabs.length === 0 ? (
        <p className="admin-empty">
          Aucune famille de services pour cet univers.
        </p>
      ) : (
        <>
          <div className="admin-tabs" role="tablist">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={`/workspace/services?world=${worldKey}&family=${tab.id}`}
                role="tab"
                aria-selected={tab.id === activeTab?.id}
                className={
                  tab.id === activeTab?.id
                    ? "admin-tabs__item admin-tabs__item--active"
                    : "admin-tabs__item"
                }
              >
                {tab.label}
                <span className="admin-tabs__count">{tab.services.length}</span>
              </Link>
            ))}
          </div>

          {activeTab && activeTab.services.length === 0 ? (
            <p className="admin-empty">Aucun service dans cette famille.</p>
          ) : activeTab ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Cycle</th>
                    <th>Disponibilité</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTab.services.map((service) => (
                    <tr key={service.id}>
                      <td>{service.name}</td>
                      <td>
                        <LifecycleBadge lifecycle={service.lifecycle} />
                      </td>
                      <td>
                        <span
                          className={`status-badge status-badge--${AVAILABILITY_TONE[service.availabilityStatus] ?? "neutral"}`}
                        >
                          {AVAILABILITY_LABEL[service.availabilityStatus] ??
                            service.availabilityStatus}
                        </span>
                      </td>
                      <td className="admin-table__actions">
                        <ServiceLifecycleActions
                          serviceId={service.id}
                          version={service.version}
                          lifecycle={service.lifecycle}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
