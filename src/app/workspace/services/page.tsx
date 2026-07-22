import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { listServicesByWorld } from "@/modules/content/application/service-use-cases";
import { PrismaServiceRepository } from "@/modules/content/infrastructure/prisma-service-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

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
    <main>
      <h1>Services</h1>
      <nav>
        {WORLDS.map((entry) => (
          <a key={entry.key} href={`/workspace/services?world=${entry.key}`}>
            {entry.label}
          </a>
        ))}
      </nav>

      {!result.ok ? (
        <p role="alert">{result.error.message}</p>
      ) : (
        <table>
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
                <td>{service.lifecycle}</td>
                <td>{service.availabilityStatus}</td>
                <td>
                  {service.lifecycle === "DRAFT" && (
                    <form action={submitForReviewAction}>
                      <input type="hidden" name="id" value={service.id} />
                      <input
                        type="hidden"
                        name="expectedVersion"
                        value={service.version}
                      />
                      <button type="submit">Soumettre pour revue</button>
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
                        <button type="submit">Publier</button>
                      </form>
                      <form action={rejectServiceAction}>
                        <input type="hidden" name="id" value={service.id} />
                        <input
                          type="hidden"
                          name="expectedVersion"
                          value={service.version}
                        />
                        <button type="submit">Renvoyer en brouillon</button>
                      </form>
                    </>
                  )}
                  {service.lifecycle === "PUBLISHED" && <span>Publié</span>}
                  {service.lifecycle === "ARCHIVED" && <span>Archivé</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
