import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import { createTaskAction } from "./actions";
import { TaskBoard, type BoardTask } from "./task-board";

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
    activeProjectId ? loadTasks(activeProjectId) : Promise.resolve([]),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { displayName: "asc" },
    }),
  ]);
  const boardTasks = tasks.map(toBoardTask);
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-content__title">Tâches et production</h1>
          <p className="admin-content__lede">
            Organisez la production, les responsabilités, délais et charges.
          </p>
        </div>
        <span className="admin-metric">
          {tasks.length} tâche{tasks.length > 1 ? "s" : ""}
        </span>
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
      <TaskBoard tasks={boardTasks} canMutate />
    </>
  );
}

function toBoardTask(
  task: Awaited<ReturnType<typeof loadTasks>>[number],
): BoardTask {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    progress: task.progress,
    dueDate: task.dueDate ? task.dueDate.toLocaleDateString("fr-FR") : null,
    assigneeName: task.assignee?.displayName ?? null,
    actualHours: task.actualMinutes ? task.actualMinutes / 60 : 0,
    parentTaskTitle: task.parentTask?.title ?? null,
    dependencyTaskTitle: task.dependencyTask?.title ?? null,
  };
}

function loadTasks(activeProjectId: string) {
  return prisma.task.findMany({
    where: { projectId: activeProjectId, status: { not: "CANCELLED" } },
    include: { assignee: true, parentTask: true, dependencyTask: true },
    orderBy: [{ position: "asc" }, { dueDate: "asc" }],
  });
}
