import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getWorkspaceRequestContext } from "./get-workspace-context";

const ACTIVE_PROJECT_STATUSES = ["PLANNED", "ACTIVE", "ON_HOLD"] as const;
const OPEN_TASK_STATUSES = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "REVIEW",
] as const;
const REVIEW_STATUSES = ["INTERNAL_REVIEW", "CLIENT_REVIEW"] as const;

export default async function WorkspaceDashboardPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ world?: string }> }>) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");

  const { world } = await searchParams;
  const worldKey = world ?? "pixel-digital";
  const now = context.clock.now();
  const weekEnd = new Date(now);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const [activeClients, projects, tasks, editorialItems, invoices, users] =
    await Promise.all([
      prisma.client.count({ where: { worldKey, status: "ACTIVE" } }),
      prisma.project.findMany({
        where: { worldKey, status: { in: [...ACTIVE_PROJECT_STATUSES] } },
        include: { client: true, projectManager: true },
        orderBy: { dueDate: "asc" },
      }),
      prisma.task.findMany({
        where: {
          project: { worldKey },
          status: { in: [...OPEN_TASK_STATUSES] },
        },
        include: { project: true, assignee: true },
        orderBy: { dueDate: "asc" },
      }),
      prisma.editorialItem.findMany({
        where: {
          worldKey,
          status: { in: [...REVIEW_STATUSES] },
        },
        include: { client: true, owner: true, reviewer: true },
        orderBy: { scheduledFor: "asc" },
      }),
      prisma.invoice.findMany({
        where: { worldKey, status: { in: ["SENT", "PAID"] } },
        include: { lines: true },
      }),
      prisma.user.findMany({
        where: { status: "ACTIVE" },
        include: {
          assignedTasks: {
            where: { status: { in: [...OPEN_TASK_STATUSES] } },
          },
        },
        orderBy: { displayName: "asc" },
      }),
    ]);

  const lateProjects = projects.filter(
    (project) => project.dueDate && project.dueDate.getTime() < now.getTime(),
  );
  const blockedTasks = tasks.filter((task) => task.status === "BLOCKED");
  const dueSoonTasks = tasks.filter(
    (task) =>
      task.dueDate &&
      task.dueDate.getTime() >= now.getTime() &&
      task.dueDate.getTime() <= weekEnd.getTime(),
  );
  const sentAmount = invoices
    .filter((invoice) => invoice.status === "SENT")
    .reduce((sum, invoice) => sum + invoiceTotal(invoice.lines), 0);
  const paidAmount = invoices
    .filter((invoice) => invoice.status === "PAID")
    .reduce((sum, invoice) => sum + invoiceTotal(invoice.lines), 0);
  const workload = users
    .map((user) => ({
      id: user.id,
      name: user.displayName ?? user.normalizedEmail ?? "Collaborateur",
      count: user.assignedTasks.length,
    }))
    .filter((user) => user.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-content__title">Tableau de bord</h1>
          <p className="admin-content__lede">
            Vue opérationnelle des urgences, validations, charge et finances.
          </p>
        </div>
        <span className="admin-metric">{activeClients} clients actifs</span>
      </div>
      <section className="dashboard-metrics">
        <Metric
          label="Projets en retard"
          value={lateProjects.length}
          href="/workspace/projects"
        />
        <Metric
          label="Tâches bloquées"
          value={blockedTasks.length}
          href="/workspace/tasks"
        />
        <Metric
          label="À valider"
          value={editorialItems.length}
          href="/workspace/editorial"
        />
        <Metric
          label="Échéances à 7 jours"
          value={dueSoonTasks.length}
          href="/workspace/tasks"
        />
        <Metric
          label="Facturé en attente"
          value={formatXof(sentAmount)}
          href="/workspace/billing"
        />
        <Metric
          label="Encaissé"
          value={formatXof(paidAmount)}
          href="/workspace/billing"
        />
      </section>

      <div className="dashboard-grid">
        <DashboardList
          title="Projets en retard"
          empty="Aucun projet en retard."
          items={lateProjects.slice(0, 6).map((project) => ({
            title: project.name,
            meta: `${project.client.name} · ${project.dueDate ? formatDate(project.dueDate) : "Sans échéance"}`,
          }))}
        />
        <DashboardList
          title="Tâches bloquées"
          empty="Aucune tâche bloquée."
          items={blockedTasks.slice(0, 6).map((task) => ({
            title: task.title,
            meta: `${task.project.name} · ${task.assignee?.displayName ?? "Non assignée"}`,
          }))}
        />
        <DashboardList
          title="Contenus à valider"
          empty="Aucun contenu en attente."
          items={editorialItems.slice(0, 6).map((item) => ({
            title: item.title,
            meta: `${item.client?.name ?? item.clientLabel} · ${item.status === "INTERNAL_REVIEW" ? "Validation interne" : "Validation client"}`,
          }))}
        />
        <DashboardList
          title="Charge par collaborateur"
          empty="Aucune tâche assignée."
          items={workload.map((user) => ({
            title: user.name,
            meta: `${user.count} tâche${user.count > 1 ? "s" : ""} ouverte${user.count > 1 ? "s" : ""}`,
          }))}
        />
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  href,
}: Readonly<{ label: string; value: string | number; href: string }>) {
  return (
    <Link href={href} className="dashboard-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </Link>
  );
}
function DashboardList({
  title,
  empty,
  items,
}: Readonly<{
  title: string;
  empty: string;
  items: readonly Readonly<{ title: string; meta: string }>[];
}>) {
  return (
    <section className="dashboard-panel">
      <h2>{title}</h2>
      {items.length === 0 ? (
        <p className="admin-empty">{empty}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={`${item.title}-${item.meta}`}>
              <strong>{item.title}</strong>
              <span>{item.meta}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function invoiceTotal(
  lines: readonly Readonly<{ quantity: number; unitPriceCents: number }>[],
): number {
  return lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPriceCents,
    0,
  );
}
function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatXof(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
