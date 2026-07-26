import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlarmClock,
  BadgeCheck,
  Banknote,
  CalendarClock,
  OctagonAlert,
  Wallet,
} from "lucide-react";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { formatCurrency, formatDate } from "@/shared/format";
import {
  DashboardList,
  Metric,
  MyWorkPanel,
  TeamMetricsSummary,
} from "./_components/dashboard-sections";
import { buildPersonalWorkFilters } from "./_lib/dashboard-personal-work";
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
const BILLING_ROLES = ["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER"] as const;

export default async function WorkspaceDashboardPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ world?: string }> }>) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");

  const { world } = await searchParams;
  const worldKey = world ?? "pixel-digital";
  const otherWorldKey =
    worldKey === "pixel-digital" ? "kwaliti-print" : "pixel-digital";
  const otherWorldLabel =
    otherWorldKey === "kwaliti-print" ? "Kwaliti Print" : "Pixel&Digital";
  const now = context.clock.now();
  const weekEnd = new Date(now);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const canSeeBilling = Boolean(
    context.actor?.role &&
    BILLING_ROLES.includes(
      context.actor.role as (typeof BILLING_ROLES)[number],
    ),
  );
  const actorId = context.actor?.id ?? null;

  const lateProjectsWhere = {
    worldKey,
    status: { in: Array.from(ACTIVE_PROJECT_STATUSES) },
    dueDate: { lt: now },
  };
  const blockedTasksWhere = {
    project: { worldKey },
    status: "BLOCKED" as const,
  };
  const dueSoonTasksWhere = {
    project: { worldKey },
    status: { in: Array.from(OPEN_TASK_STATUSES) },
    dueDate: { gte: now, lte: weekEnd },
  };
  const toValidateWhere = {
    worldKey,
    status: { in: Array.from(REVIEW_STATUSES) },
  };
  const personalFilters = actorId
    ? buildPersonalWorkFilters({ actorId, worldKey })
    : null;

  const [
    activeClients,
    lateProjectsCount,
    lateProjectsPreview,
    blockedTasksCount,
    blockedTasksPreview,
    dueSoonTasksCount,
    toValidateCount,
    toValidatePreview,
    invoices,
    users,
    otherClients,
    otherActiveProjects,
    otherPendingReviews,
    myTasksCount,
    myTasksPreview,
    myReviewsCount,
    myReviewsPreview,
    myLeadsCount,
    myLeadsPreview,
  ] = await Promise.all([
    prisma.client.count({ where: { worldKey, status: "ACTIVE" } }),
    prisma.project.count({ where: lateProjectsWhere }),
    prisma.project.findMany({
      where: lateProjectsWhere,
      include: { client: true },
      orderBy: { dueDate: "asc" },
      take: 6,
    }),
    prisma.task.count({ where: blockedTasksWhere }),
    prisma.task.findMany({
      where: blockedTasksWhere,
      include: { project: true, assignee: true },
      orderBy: { dueDate: "asc" },
      take: 6,
    }),
    prisma.task.count({ where: dueSoonTasksWhere }),
    prisma.editorialItem.count({ where: toValidateWhere }),
    prisma.editorialItem.findMany({
      where: toValidateWhere,
      include: { client: true },
      orderBy: { scheduledFor: "asc" },
      take: 6,
    }),
    canSeeBilling
      ? prisma.invoice.findMany({
          where: { worldKey, status: { in: ["SENT", "PAID"] } },
          include: { lines: true },
        })
      : Promise.resolve([]),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      include: {
        assignedTasks: {
          where: { status: { in: [...OPEN_TASK_STATUSES] } },
        },
      },
      orderBy: { displayName: "asc" },
    }),
    prisma.client.count({
      where: { worldKey: otherWorldKey, status: "ACTIVE" },
    }),
    prisma.project.count({
      where: {
        worldKey: otherWorldKey,
        status: { in: [...ACTIVE_PROJECT_STATUSES] },
      },
    }),
    prisma.editorialItem.count({
      where: {
        worldKey: otherWorldKey,
        status: { in: [...REVIEW_STATUSES] },
      },
    }),
    personalFilters
      ? prisma.task.count({ where: personalFilters.tasks })
      : Promise.resolve(0),
    personalFilters
      ? prisma.task.findMany({
          where: personalFilters.tasks,
          include: { project: true },
          orderBy: { dueDate: "asc" },
          take: 6,
        })
      : Promise.resolve([]),
    personalFilters
      ? prisma.editorialItem.count({ where: personalFilters.reviews })
      : Promise.resolve(0),
    personalFilters
      ? prisma.editorialItem.findMany({
          where: personalFilters.reviews,
          include: { client: true },
          orderBy: { scheduledFor: "asc" },
          take: 6,
        })
      : Promise.resolve([]),
    personalFilters
      ? prisma.lead.count({ where: personalFilters.leads })
      : Promise.resolve(0),
    personalFilters
      ? prisma.lead.findMany({
          where: personalFilters.leads,
          orderBy: { createdAt: "desc" },
          take: 6,
        })
      : Promise.resolve([]),
  ]);

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
        <span className="admin-metric">
          {activeClients} client{activeClients > 1 ? "s" : ""} actif
          {activeClients > 1 ? "s" : ""}
        </span>
      </div>

      <MyWorkPanel
        queues={[
          {
            title: "Mes tâches ouvertes",
            empty: "Aucune tâche qui vous est assignée.",
            items: myTasksPreview.map((task) => ({
              title: task.title,
              meta: `${task.project.name} · ${task.dueDate ? formatDate(task.dueDate) : "Sans échéance"}`,
            })),
            count: myTasksCount,
            href: `/workspace/tasks?world=${worldKey}`,
          },
          {
            title: "Contenus à valider par vous",
            empty: "Aucun contenu à valider de votre côté.",
            items: myReviewsPreview.map((item) => ({
              title: item.title,
              meta: `${item.client?.name ?? item.clientLabel} · ${formatDate(item.scheduledFor)}`,
            })),
            count: myReviewsCount,
            href: `/workspace/editorial?world=${worldKey}`,
          },
          {
            title: "Vos leads à traiter",
            empty: "Aucun lead qui vous est assigné pour le moment.",
            items: myLeadsPreview.map((lead) => ({
              title: lead.name,
              meta: `${lead.source} · ${lead.status === "NEW" ? "Nouveau" : "En qualification"}`,
            })),
            count: myLeadsCount,
            href: `/workspace/enquiries?world=${worldKey}`,
          },
        ]}
      />

      <TeamMetricsSummary
        metrics={
          <section className="dashboard-metrics">
            <Metric
              label="Projets en retard"
              value={lateProjectsCount}
              href="/workspace/projects"
              tone="danger"
              icon={<AlarmClock size={20} />}
            />
            <Metric
              label="Tâches bloquées"
              value={blockedTasksCount}
              href="/workspace/tasks"
              tone="warning"
              icon={<OctagonAlert size={20} />}
            />
            <Metric
              label="À valider"
              value={toValidateCount}
              href="/workspace/editorial"
              tone="info"
              icon={<BadgeCheck size={20} />}
            />
            <Metric
              label="Échéances à 7 jours"
              value={dueSoonTasksCount}
              href="/workspace/tasks"
              tone="violet"
              icon={<CalendarClock size={20} />}
            />
            {canSeeBilling ? (
              <>
                <Metric
                  label="Facturé en attente"
                  value={formatCurrency(sentAmount)}
                  href="/workspace/billing"
                  tone="accent"
                  icon={<Banknote size={20} />}
                />
                <Metric
                  label="Encaissé"
                  value={formatCurrency(paidAmount)}
                  href="/workspace/billing"
                  tone="success"
                  icon={<Wallet size={20} />}
                />
              </>
            ) : null}
          </section>
        }
      >
        <div className="dashboard-grid">
          <DashboardList
            title="Projets en retard"
            empty="Aucun projet en retard."
            items={lateProjectsPreview.map((project) => ({
              title: project.name,
              meta: `${project.client.name} · ${project.dueDate ? formatDate(project.dueDate) : "Sans échéance"}`,
            }))}
          />
          <DashboardList
            title="Tâches bloquées"
            empty="Aucune tâche bloquée."
            items={blockedTasksPreview.map((task) => ({
              title: task.title,
              meta: `${task.project.name} · ${task.assignee?.displayName ?? "Non assignée"}`,
            }))}
          />
          <DashboardList
            title="Contenus à valider"
            empty="Aucun contenu en attente."
            items={toValidatePreview.map((item) => ({
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
          <section className="dashboard-panel dashboard-panel--crossworld">
            <h2>{otherWorldLabel} en un coup d’œil</h2>
            <ul>
              <li>
                <strong>
                  {otherClients} client{otherClients > 1 ? "s" : ""} actif
                  {otherClients > 1 ? "s" : ""}
                </strong>
                <span>Comptes de l’autre univers</span>
              </li>
              <li>
                <strong>
                  {otherActiveProjects} projet
                  {otherActiveProjects > 1 ? "s" : ""} en cours
                </strong>
                <span>Production {otherWorldLabel}</span>
              </li>
              <li>
                <strong>
                  {otherPendingReviews} contenu
                  {otherPendingReviews > 1 ? "s" : ""} à valider
                </strong>
                <span>Calendrier éditorial</span>
              </li>
            </ul>
            <Link
              className="admin-table__action"
              href={`/workspace?world=${otherWorldKey}`}
            >
              Basculer vers {otherWorldLabel}
            </Link>
          </section>
        </div>
      </TeamMetricsSummary>
    </>
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
