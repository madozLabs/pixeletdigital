import Link from "next/link";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getPageBlockDefinition } from "@/modules/content/domain/page-block-registry";
import {
  CreateGlobalComponentForm,
  DeleteGlobalComponentForm,
} from "../site-content-forms";

export default async function CmsComponentsRoute({
  searchParams,
}: Readonly<{ searchParams: Promise<{ world?: string }> }>) {
  const { world = "pixel-digital" } = await searchParams;
  const worldKey = world;

  const [components, libraryPage] = await Promise.all([
    prisma.globalComponent.findMany({
      where: { worldKey },
      orderBy: { name: "asc" },
    }),
    prisma.page.findFirst({
      where: { worldKey, pageKind: "COMPONENT_LIBRARY" },
      select: { id: true },
    }),
  ]);
  const usageCounts = components.length
    ? await prisma.pageRevisionSection.groupBy({
        by: ["globalComponentId"],
        where: { globalComponentId: { in: components.map((c) => c.id) } },
        _count: { _all: true },
      })
    : [];
  const usageCountById = new Map(
    usageCounts.map((row) => [row.globalComponentId, row._count._all]),
  );

  return (
    <div className="cms-focused-screen">
      <div className="cms-screen-heading">
        <div>
          <span>Composants globaux</span>
          <h1>Composants réutilisables</h1>
          <p>
            Un composant modifié une fois change instantanément sur toutes
            les pages qui l’utilisent. Son contenu se remplit via
            l’éditeur de page habituel, sur une page cachée dédiée.
          </p>
        </div>
      </div>
      <div className="cms-create-page-card">
        <CreateGlobalComponentForm worldKey={worldKey} />
      </div>
      {components.length === 0 ? (
        <p className="admin-empty">
          Aucun composant global pour l’instant. Créez-en un ci-dessus.
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Type de bloc</th>
                <th>Utilisations</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {components.map((component) => {
                const usageCount = usageCountById.get(component.id) ?? 0;
                return (
                  <tr key={component.id}>
                    <td>{component.name}</td>
                    <td>
                      {getPageBlockDefinition(component.sectionType)?.label ??
                        component.sectionType}
                    </td>
                    <td>{usageCount}</td>
                    <td>
                      {libraryPage ? (
                        <Link
                          className="admin-table__action"
                          href={`/workspace/site-content/pages/${libraryPage.id}/edit?world=${worldKey}`}
                        >
                          Modifier
                        </Link>
                      ) : null}
                      <DeleteGlobalComponentForm
                        componentId={component.id}
                        usageCount={usageCount}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
