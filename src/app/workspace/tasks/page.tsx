import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import { createTaskAction, updateTaskAction } from "./actions";

const COLUMNS = [
  ["BACKLOG", "Backlog"],
  ["TODO", "À faire"],
  ["IN_PROGRESS", "En cours"],
  ["BLOCKED", "Bloqué"],
  ["REVIEW", "Validation"],
  ["DONE", "Terminé"],
] as const;

const PRIORITY_LABEL: Readonly<Record<string, string>> = {
  LOW: "Faible",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
};
export default async function TasksPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ world?: string; project?: string }> }>) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");
  if (!context.actor || context.actor.role === "READER") {
    return (
      <p role="alert">Vous n&apos;êtes pas autorisé à gérer les tâches.</p>
    );
  }

  const { world, project } = await searchParams;
  const worldKey = world ?? "pixel-digital";
  const projects = await prisma.project.findMany({
    where: { worldKey, status: { not: "CANCELLED" } },
    include: { client: true },
    orderBy: { name: "asc" },
  });
  const activeProjectId = project ?? projects[0]?.id ?? null;
  const [tasks, users] = await Promise.all([
    activeProjectId
      ? prisma.task.findMany({
          where: { projectId: activeProjectId, status: { not: "CANCELLED" } },
          include: { assignee: true, parentTask: true, dependencyTask: true },
          orderBy: [{ position: "asc" }, { dueDate: "asc" }],
        })
      : Promise.resolve([]),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { displayName: "asc" },
    }),
  ]);
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-content__title">Tâches et production</h1>
          <p className="admin-content__lede">
            Organisez la production, les responsabilités, délais et charges.
          </p>
        </div>
        <span className="admin-metric">{tasks.length} tâches</span>
      </div>

      <form className="admin-form-card" method="get">
        <input type="hidden" name="world" value={worldKey} />
        <label>
          Projet actif
          <select name="project" defaultValue={activeProjectId ?? ""}>
            {projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.client.name} · {item.name}
              </option>
            ))}
          </select>
        </label>
        <button className="admin-table__action" type="submit">
          Afficher
        </button>
      </form>
      {activeProjectId ? (
        <form action={createTaskAction} className="admin-form-card">
          <input type="hidden" name="projectId" value={activeProjectId} />
          <h2 className="admin-content__subtitle">Créer une tâche</h2>
          <div className="admin-form-grid">
            <label>
              Titre
              <input name="title" required maxLength={160} />
            </label>
            <label>
              Responsable
              <select name="assigneeId" defaultValue="">
                <option value="">Non affecté</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName ?? user.normalizedEmail}
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
              Échéance
              <input name="dueDate" type="date" />
            </label>
            <label>
              Temps estimé (heures)
              <input name="estimatedHours" type="number" min={0} step="0.25" />
            </label>
            <label>
              Sous-tâche de
              <select name="parentTaskId" defaultValue="">
                <option value="">Aucune</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Dépend de
              <select name="dependencyTaskId" defaultValue="">
                <option value="">Aucune</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Description
            <textarea name="description" maxLength={1000} />
          </label>
          <button className="admin-table__action" type="submit">
            Créer la tâche
          </button>
        </form>
      ) : null}
      <section className="task-board">
        {COLUMNS.map(([status, label]) => {
          const columnTasks = tasks.filter((task) => task.status === status);
          return (
            <section key={status} className="task-column">
              <header className="task-column__header">
                <h2>{label}</h2>
                <span>{columnTasks.length}</span>
              </header>
              <div className="task-column__list">
                {columnTasks.length === 0 ? (
                  <p className="admin-empty">Aucune tâche.</p>
                ) : null}
                {columnTasks.map((task) => (
                  <article key={task.id} className="task-card">
                    <div className="task-card__topline">
                      <span>{PRIORITY_LABEL[task.priority]}</span>
                      {task.dueDate ? (
                        <time>{task.dueDate.toLocaleDateString("fr-FR")}</time>
                      ) : null}
                    </div>
                    <h3>{task.title}</h3>
                    <p>{task.assignee?.displayName ?? "Non affecté"}</p>
                    {task.parentTask ? (
                      <small>Sous-tâche de {task.parentTask.title}</small>
                    ) : null}
                    {task.dependencyTask ? (
                      <small>Dépend de {task.dependencyTask.title}</small>
                    ) : null}
                    <div className="project-progress">
                      <span style={{ width: `${task.progress}%` }} />
                    </div>
                    <form
                      action={updateTaskAction}
                      className="task-card__controls"
                    >
                      <input type="hidden" name="taskId" value={task.id} />
                      <select name="status" defaultValue={task.status}>
                        <option value="BACKLOG">Backlog</option>
                        <option value="TODO">À faire</option>
                        <option value="IN_PROGRESS">En cours</option>
                        <option value="BLOCKED">Bloqué</option>
                        <option value="REVIEW">Validation</option>
                        <option value="DONE">Terminé</option>
                        <option value="CANCELLED">Annulé</option>
                      </select>
                      <input
                        name="progress"
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={task.progress}
                        aria-label="Progression"
                      />
                      <input
                        name="actualHours"
                        type="number"
                        min={0}
                        step="0.25"
                        defaultValue={
                          task.actualMinutes ? task.actualMinutes / 60 : 0
                        }
                        aria-label="Temps réalisé en heures"
                      />
                      <button className="admin-table__action" type="submit">
                        Mettre à jour
                      </button>
                    </form>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </section>
    </>
  );
}
