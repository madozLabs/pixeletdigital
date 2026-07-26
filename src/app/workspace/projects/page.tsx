import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { parsePage, toSkipTake } from "@/shared/pagination";
import { Pagination } from "../_components/pagination";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import { CreateProjectForm, UpdateProjectForm } from "./project-forms";

const PROJECT_ROLES = ["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER"] as const;

const STATUS_LABEL: Readonly<Record<string, string>> = {
  PLANNED: "Planifié",
  ACTIVE: "Actif",
  ON_HOLD: "En pause",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
};

const PRIORITY_LABEL: Readonly<Record<string, string>> = {
  LOW: "Faible",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
};
export default async function ProjectsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ world?: string; page?: string }>;
}>) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");
  if (
    !context.actor?.role ||
    !PROJECT_ROLES.includes(
      context.actor.role as (typeof PROJECT_ROLES)[number],
    )
  ) {
    return (
      <p role="alert">Vous n&apos;êtes pas autorisé à gérer les projets.</p>
    );
  }

  const { world, page: pageParam } = await searchParams;
  const worldKey = world ?? "pixel-digital";
  const pageParams = parsePage(pageParam);
  const { skip, take } = toSkipTake(pageParams);
  const [projects, totalProjects, clients, users, teams] = await Promise.all([
    prisma.project.findMany({
      where: { worldKey },
      include: { client: true, projectManager: true, team: true },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      skip,
      take,
    }),
    prisma.project.count({ where: { worldKey } }),
    prisma.client.findMany({
      where: { worldKey, status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { displayName: "asc" },
    }),
    prisma.team.findMany({ orderBy: { name: "asc" } }),
  ]);
  const totalPages = Math.max(
    1,
    Math.ceil(totalProjects / pageParams.pageSize),
  );
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-content__title">Projets et campagnes</h1>
          <p className="admin-content__lede">
            Pilotez les projets clients, responsables, équipes, budgets et
            échéances.
          </p>
        </div>
        <span className="admin-metric">
          {totalProjects} projet{totalProjects > 1 ? "s" : ""}
        </span>
      </div>

      <CreateProjectForm
        worldKey={worldKey}
        clients={clients.map((client) => ({
          value: client.id,
          label: client.name,
        }))}
        users={users.map((user) => ({
          value: user.id,
          label: user.displayName ?? user.normalizedEmail ?? "Collaborateur",
        }))}
        teams={teams.map((team) => ({ value: team.id, label: team.name }))}
      />
      <section className="project-grid">
        {projects.length === 0 ? (
          <p className="admin-empty">Aucun projet.</p>
        ) : null}
        {projects.map((project) => (
          <article key={project.id} className="project-card">
            <header className="project-card__header">
              <div>
                <p className="project-card__client">{project.client.name}</p>
                <h2>{project.name}</h2>
              </div>
              <span
                className={`status-badge status-badge--${project.status.toLowerCase()}`}
              >
                {STATUS_LABEL[project.status]}
              </span>
            </header>
            <dl className="project-card__meta">
              <div>
                <dt>Priorité</dt>
                <dd>{PRIORITY_LABEL[project.priority]}</dd>
              </div>
              <div>
                <dt>Chef de projet</dt>
                <dd>{project.projectManager?.displayName ?? "Non affecté"}</dd>
              </div>
              <div>
                <dt>Équipe</dt>
                <dd>{project.team?.name ?? "Non affectée"}</dd>
              </div>
              <div>
                <dt>Échéance</dt>
                <dd>
                  {project.dueDate
                    ? project.dueDate.toLocaleDateString("fr-FR")
                    : "Non définie"}
                </dd>
              </div>
            </dl>
            {project.description ? <p>{project.description}</p> : null}
            <div className="project-progress">
              <span style={{ width: `${project.progress}%` }} />
            </div>
            <UpdateProjectForm
              projectId={project.id}
              status={project.status}
              progress={project.progress}
            />
          </article>
        ))}
      </section>

      <Pagination
        basePath="/workspace/projects"
        searchParams={{ world: worldKey }}
        page={pageParams.page}
        totalPages={totalPages}
        total={totalProjects}
      />
    </>
  );
}
