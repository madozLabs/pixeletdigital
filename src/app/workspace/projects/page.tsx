import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import { createProjectAction, updateProjectAction } from "./actions";

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
}: Readonly<{ searchParams: Promise<{ world?: string }> }>) {
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

  const { world } = await searchParams;
  const worldKey = world ?? "pixel-digital";
  const [projects, clients, users, teams] = await Promise.all([
    prisma.project.findMany({
      where: { worldKey },
      include: { client: true, projectManager: true, team: true },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    }),
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
        <span className="admin-metric">{projects.length} projets</span>
      </div>

      <form action={createProjectAction} className="admin-form-card">
        <input type="hidden" name="worldKey" value={worldKey} />
        <h2 className="admin-content__subtitle">Créer un projet</h2>
        <div className="admin-form-grid">
          <label>
            Nom
            <input name="name" required maxLength={160} />
          </label>
          <label>
            Client
            <select name="clientId" required>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Chef de projet
            <select name="projectManagerId" defaultValue="">
              <option value="">Non affecté</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName ?? user.normalizedEmail}
                </option>
              ))}
            </select>
          </label>
          <label>
            Équipe
            <select name="teamId" defaultValue="">
              <option value="">Non affectée</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priorité
            <select name="priority" defaultValue="NORMAL">
              <option value="LOW">Faible</option>
              <option value="NORMAL">Normale</option>
              <option value="HIGH">Haute</option>
              <option value="URGENT">Urgente</option>
            </select>
          </label>
          <label>
            Budget (XOF)
            <input name="budget" type="number" min={0} step={1} />
          </label>
          <label>
            Début
            <input name="startDate" type="date" />
          </label>
          <label>
            Échéance
            <input name="dueDate" type="date" />
          </label>
        </div>
        <label>
          Description
          <textarea name="description" maxLength={1000} />
        </label>
        <button type="submit" className="admin-table__action">
          Créer le projet
        </button>
      </form>
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
            <form
              action={updateProjectAction}
              className="project-card__controls"
            >
              <input type="hidden" name="projectId" value={project.id} />
              <select name="status" defaultValue={project.status}>
                <option value="PLANNED">Planifié</option>
                <option value="ACTIVE">Actif</option>
                <option value="ON_HOLD">En pause</option>
                <option value="COMPLETED">Terminé</option>
                <option value="CANCELLED">Annulé</option>
              </select>
              <input
                name="progress"
                type="number"
                min={0}
                max={100}
                defaultValue={project.progress}
                aria-label="Progression en pourcentage"
              />
              <button type="submit" className="admin-table__action">
                Mettre à jour
              </button>
            </form>
          </article>
        ))}
      </section>
    </>
  );
}
