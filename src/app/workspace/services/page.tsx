import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { listServicesByWorld } from "@/modules/content/application/service-use-cases";
import { PrismaServiceRepository } from "@/modules/content/infrastructure/prisma-service-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { LifecycleBadge } from "../_components/status-badge";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import {
  publishServiceAction,
  rejectServiceAction,
  submitForReviewAction,
} from "./actions";

const WORLDS = [
  { key: "pixel-digital", label: "Pixel&Digital" },
  { key: "kwaliti-print", label: "Kwaliti Print" },
];

export default async function WorkspaceServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ world?: string }>;
}) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");

  const { world } = await searchParams;
  const worldKey = world ?? WORLDS[0]!.key;

  const result = await listServicesByWorld(
    {
      services: new PrismaServiceRepository(prisma),
      worlds: new PrismaWorldRepository(prisma),
    },
    context,
    { worldKey },
  );

  return (
    <>
      <h1 className="admin-content__title">Services</h1>

      {!result.ok ? (
        <p role="alert">{result.error.message}</p>
      ) : (
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
              {result.value.map((service) => (
                <tr key={service.id}>
                  <td>{service.name}</td>
                  <td>
                    <LifecycleBadge lifecycle={service.lifecycle} />
                  </td>
                  <td>{service.availabilityStatus}</td>
                  <td className="admin-table__actions">
                    {service.lifecycle === "DRAFT" && (
                      <form action={submitForReviewAction}>
                        <input type="hidden" name="id" value={service.id} />
                        <input
                          type="hidden"
                          name="expectedVersion"
                          value={service.version}
                        />
                        <button type="submit" className="admin-table__action">
                          Soumettre pour revue
                        </button>
                      </form>
                    )}
                    {service.lifecycle === "IN_REVIEW" && (
                      <>
                        <form action={publishServiceAction}>
                          <input type="hidden" name="id" value={service.id} />
                          <input
                            type="hidden"
                            name="expectedVersion"
                            value={service.version}
                          />
                          <button type="submit" className="admin-table__action">
                            Publier
                          </button>
                        </form>
                        <form action={rejectServiceAction}>
                          <input type="hidden" name="id" value={service.id} />
                          <input
                            type="hidden"
                            name="expectedVersion"
                            value={service.version}
                          />
                          <button type="submit" className="admin-table__action">
                            Renvoyer en brouillon
                          </button>
                        </form>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
