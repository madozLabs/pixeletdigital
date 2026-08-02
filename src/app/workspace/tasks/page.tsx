import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import { CreateTaskForm } from "./create-task-form";
import { TaskBoard, type BoardTask } from "./task-board";

export default async function TasksPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ world?: string; project?: string; mine?: string }>;
}>) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");
  if (!context.actor || context.actor.role === "READER") {
    return (
      <p role="alert">Vous n&apos;êtes pas autorisé à gérer les tâches.</p>
    );
  }

  const { world, project, mine } = await searchParams;
  const worldKey = world ?? "pixel-digital";
  const mineOnly = mine === "1";
  const actorId = context.actor.id;
  const projects = await prisma.project.findMany({
    where: { worldKey, status: { not: "CANCELLED" } },
    include: { client: true },
    orderBy: { name: "asc" },
  });
  const activeProjectId = project ?? projects[0]?.id ?? null;
  const [allProjectTasks, users] = await Promise.all([
    activeProjectId ? loadTasks(activeProjectId) : Promise.resolve([]),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { displayName: "asc" },
    }),
  ]);
  const myTaskCount = allProjectTasks.filter(
    (task) => task.assigneeId === actorId,
  ).length;
  const tasks = mineOnly
    ? allProjectTasks.filter((task) => task.assigneeId === actorId)
    : allProjectTasks;
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

      <Link
        className="admin-table__action"
        href={`/workspace/tasks/schedule?world=${worldKey}`}
      >
        Planning imprimable
      </Link>

      <form className="admin-form-card" method="get">
        <input type="hidden" name="world" value={worldKey} />
        {mineOnly ? <input type="hidden" name="mine" value="1" /> : null}
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

      <div className="admin-tabs" role="tablist">
        <Link
          href={`/workspace/tasks?world=${worldKey}${activeProjectId ? `&project=${activeProjectId}` : ""}`}
          role="tab"
          aria-selected={!mineOnly}
          className={
            mineOnly ? "admin-tabs__item" : "admin-tabs__item admin-tabs__item--active"
          }
        >
          Toutes les tâches ({allProjectTasks.length})
        </Link>
        <Link
          href={`/workspace/tasks?world=${worldKey}${activeProjectId ? `&project=${activeProjectId}` : ""}&mine=1`}
          role="tab"
          aria-selected={mineOnly}
          className={
            mineOnly ? "admin-tabs__item admin-tabs__item--active" : "admin-tabs__item"
          }
        >
          Mes tâches ({myTaskCount})
        </Link>
      </div>

      {activeProjectId ? (
        <CreateTaskForm
          activeProjectId={activeProjectId}
          users={users.map((user) => ({
            id: user.id,
            label: user.displayName ?? user.normalizedEmail ?? "Collaborateur",
          }))}
          tasks={allProjectTasks.map((task) => ({
            id: task.id,
            label: task.title,
          }))}
        />
      ) : null}
      <TaskBoard
        tasks={boardTasks}
        canMutate
        currentUserId={actorId}
        users={users.map((user) => ({
          id: user.id,
          name: user.displayName ?? user.normalizedEmail ?? "Collaborateur",
        }))}
        revalidatePathHint={`/workspace/tasks?world=${worldKey}${activeProjectId ? `&project=${activeProjectId}` : ""}`}
      />
    </>
  );
}

function toBoardTask(
  task: Awaited<ReturnType<typeof loadTasks>>[number],
): BoardTask {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    progress: task.progress,
    version: task.version,
    dueDate: task.dueDate ? task.dueDate.toLocaleDateString("fr-FR") : null,
    dueDateIso: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
    assigneeId: task.assigneeId,
    assigneeName: task.assignee?.displayName ?? null,
    actualHours: task.actualMinutes ? task.actualMinutes / 60 : 0,
    estimatedHours: task.estimatedMinutes ? task.estimatedMinutes / 60 : null,
    parentTaskId: task.parentTaskId,
    parentTaskTitle: task.parentTask?.title ?? null,
    dependencyTaskId: task.dependencyTaskId,
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
