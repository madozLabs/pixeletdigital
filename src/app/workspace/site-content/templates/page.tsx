import { prisma } from "@/infrastructure/shared/prisma-client";
import { DeletePageTemplateForm } from "../site-content-forms";

export default async function CmsTemplatesRoute({
  searchParams,
}: Readonly<{ searchParams: Promise<{ world?: string }> }>) {
  const { world = "pixel-digital" } = await searchParams;
  const worldKey = world;

  const templates = await prisma.pageTemplate.findMany({
    where: { worldKey },
    orderBy: { name: "asc" },
  });

  return (
    <div className="cms-focused-screen">
      <div className="cms-screen-heading">
        <div>
          <span>Gabarits de page</span>
          <h1>Gabarits réutilisables</h1>
          <p>
            Un gabarit copie les blocs d’une page existante pour démarrer une
            nouvelle page sans repartir de zéro. Enregistrez-en un depuis
            l’onglet « Page & SEO » de l’éditeur d’une page.
          </p>
        </div>
      </div>
      {templates.length === 0 ? (
        <p className="admin-empty">
          Aucun gabarit pour l’instant. Ouvrez une page existante et
          enregistrez-la comme gabarit depuis l’onglet « Page & SEO ».
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Blocs</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id}>
                  <td>{template.name}</td>
                  <td>
                    {Array.isArray(template.sections)
                      ? template.sections.length
                      : 0}
                  </td>
                  <td>
                    <DeletePageTemplateForm templateId={template.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
