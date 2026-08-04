import Link from "next/link";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { CreatePageForm } from "../../site-content-forms";

export default async function NewCmsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ world?: string }> }>) {
  const { world = "pixel-digital" } = await searchParams;
  const templates = await prisma.pageTemplate.findMany({
    where: { worldKey: world },
    orderBy: { name: "asc" },
  });
  return (
    <div className="cms-focused-screen">
      <div className="cms-screen-heading">
        <div>
          <span>Pages</span>
          <h1>Créer une nouvelle page</h1>
          <p>
            Donnez-lui un nom et une adresse. Vous composerez son contenu dans
            l’éditeur visuel à l’étape suivante.
          </p>
        </div>
        <Link href={`/workspace/site-content/pages?world=${world}`}>
          ← Annuler
        </Link>
      </div>
      <div className="cms-create-page-card">
        <CreatePageForm
          worldKey={world}
          templates={templates.map((template) => ({
            id: template.id,
            name: template.name,
            blockCount: Array.isArray(template.sections)
              ? template.sections.length
              : 0,
          }))}
        />
      </div>
    </div>
  );
}
