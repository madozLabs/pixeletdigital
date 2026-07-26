import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import type { ApprovedRole } from "@/shared/request-context";
import { formatShortDate } from "@/shared/format";
import { StatusBadge } from "../_components/status-badge";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import {
  CreateEditorialItemForm,
  EditorialWorkflowForm,
} from "./editorial-forms";
import { EditorialPipeline, type PipelineItem } from "./pipeline-board";
import {
  addDays,
  formatISODate,
  parseISODate,
  WEEKDAY_LABELS,
} from "./_lib/week";

const MUTATE_ROLES: readonly ApprovedRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "WORLD_MANAGER",
  "EDITOR",
];

const CONTENT_LABEL: Readonly<Record<string, string>> = {
  POST: "Post",
  STORY: "Story",
  REEL: "Reel",
  VIDEO: "Vidéo",
  ARTICLE: "Article",
  EMAIL: "E-mail",
  AD: "Publicité",
  OTHER: "Autre",
};

export default async function WorkspaceEditorialPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ world?: string; week?: string; view?: string }>;
}>) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");

  const { world, week, view } = await searchParams;
  const worldKey = world ?? "pixel-digital";
  const activeView = view === "pipeline" ? "pipeline" : "week";
  const now = context.clock.now();
  const weekStart = parseISODate(week, now);
  const weekEnd = addDays(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );
  const canMutate = Boolean(
    context.actor?.role && MUTATE_ROLES.includes(context.actor.role),
  );

  const [items, clients, projects, users] = await Promise.all([
    prisma.editorialItem.findMany({
      where: { worldKey },
      include: { client: true, project: true, owner: true, reviewer: true },
      orderBy: { scheduledFor: "asc" },
    }),
    prisma.client.findMany({
      where: { worldKey, status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({ where: { worldKey }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { displayName: "asc" },
    }),
  ]);
  const itemsByDay = new Map<string, typeof items>();
  for (const item of items) {
    const key = formatISODate(item.scheduledFor);
    const bucket = itemsByDay.get(key) ?? [];
    itemsByDay.set(key, [...bucket, item]);
  }

  const previousWeekHref = `/workspace/editorial?world=${worldKey}&week=${formatISODate(addDays(weekStart, -7))}`;
  const nextWeekHref = `/workspace/editorial?world=${worldKey}&week=${formatISODate(addDays(weekStart, 7))}`;

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-content__title">Calendrier éditorial</h1>
          <p className="admin-content__lede">
            Briefs, production, validations internes et client, programmation et
            publication.
          </p>
        </div>
        <span className="admin-metric">
          {items.length} contenu{items.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="admin-tabs" role="tablist">
        <Link
          href={`/workspace/editorial?world=${worldKey}&view=week`}
          role="tab"
          aria-selected={activeView === "week"}
          className={
            activeView === "week"
              ? "admin-tabs__item admin-tabs__item--active"
              : "admin-tabs__item"
          }
        >
          Semaine
        </Link>
        <Link
          href={`/workspace/editorial?world=${worldKey}&view=pipeline`}
          role="tab"
          aria-selected={activeView === "pipeline"}
          className={
            activeView === "pipeline"
              ? "admin-tabs__item admin-tabs__item--active"
              : "admin-tabs__item"
          }
        >
          Pipeline
        </Link>
      </div>

      {activeView === "pipeline" ? (
        <EditorialPipeline
          items={items
            .filter((item) => item.status !== "CANCELLED")
            .map((item): PipelineItem => ({
              id: item.id,
              title: item.title,
              status: item.status,
              clientName: item.client?.name ?? item.clientLabel,
              contentType: CONTENT_LABEL[item.contentType] ?? item.contentType,
              channel: item.channel,
              scheduledFor: formatDayLabel(item.scheduledFor),
              ownerName:
                item.owner?.displayName ?? item.owner?.normalizedEmail ?? null,
            }))}
          canMutate={canMutate}
        />
      ) : null}

      {activeView === "week" ? (
        <>
          <div className="editorial-week-nav">
            <Link href={previousWeekHref} className="admin-table__action">
              Semaine précédente
            </Link>
            <span className="editorial-week-nav__label">
              Semaine du {formatDayLabel(weekStart)} au{" "}
              {formatDayLabel(weekEnd)}
            </span>
            <Link href={nextWeekHref} className="admin-table__action">
              Semaine suivante
            </Link>
          </div>
          <div className="editorial-board">
            {days.map((day, index) => {
              const key = formatISODate(day);
              const dayItems = itemsByDay.get(key) ?? [];
              return (
                <section key={key} className="editorial-board__day">
                  <div className="editorial-board__day-header">
                    <span>{WEEKDAY_LABELS[index]}</span>
                    <span className="editorial-board__day-date">
                      {formatDayLabel(day)}
                    </span>
                  </div>
                  {dayItems.length === 0 ? (
                    <p className="editorial-board__empty">Rien de prévu</p>
                  ) : (
                    dayItems.map((item) => (
                      <article
                        key={item.id}
                        className="editorial-card editorial-card--professional"
                      >
                        <StatusBadge kind="editorial" status={item.status} />
                        <p className="editorial-card__title">{item.title}</p>
                        <p className="editorial-card__meta">
                          {item.client?.name ?? item.clientLabel} ·{" "}
                          {CONTENT_LABEL[item.contentType]} · {item.channel}
                        </p>
                        {item.project ? (
                          <p className="editorial-card__meta">
                            Projet : {item.project.name}
                          </p>
                        ) : null}
                        {item.owner ? (
                          <p className="editorial-card__meta">
                            Responsable :{" "}
                            {item.owner.displayName ??
                              item.owner.normalizedEmail}
                          </p>
                        ) : null}
                        {item.brief ? (
                          <p className="editorial-card__brief">{item.brief}</p>
                        ) : null}
                        {canMutate &&
                        item.status !== "PUBLISHED" &&
                        item.status !== "CANCELLED" ? (
                          <EditorialWorkflowForm
                            itemId={item.id}
                            version={item.version}
                            status={item.status}
                          />
                        ) : null}
                      </article>
                    ))
                  )}
                </section>
              );
            })}
          </div>
        </>
      ) : null}

      {canMutate ? (
        <CreateEditorialItemForm
          worldKey={worldKey}
          clients={clients.map((client) => ({
            id: client.id,
            label: client.name,
          }))}
          projects={projects.map((project) => ({
            id: project.id,
            label: project.name,
          }))}
          users={users.map((user) => ({
            id: user.id,
            label: user.displayName ?? user.normalizedEmail ?? "Collaborateur",
          }))}
          defaultScheduledFor={formatISODate(weekStart)}
        />
      ) : null}
    </>
  );
}

function formatDayLabel(date: Date): string {
  return formatShortDate(date);
}
