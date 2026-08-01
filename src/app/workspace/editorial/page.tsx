import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarClock,
  FileText,
  Film,
  FolderKanban,
  Image as ImageIcon,
  Mail,
  Megaphone,
  Newspaper,
  User,
  Video,
  type LucideIcon,
} from "lucide-react";

import { prisma } from "@/infrastructure/shared/prisma-client";
import type { ApprovedRole } from "@/shared/request-context";
import { formatShortDate } from "@/shared/format";
import { CommentThread } from "../_components/comment-thread";
import { StatusBadge } from "../_components/status-badge";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import {
  CreateEditorialItemForm,
  EditorialWorkflowForm,
} from "./editorial-forms";
import { EditorialPipeline, type PipelineItem } from "./pipeline-board";
import {
  addDays,
  addMonths,
  formatISODate,
  formatMonthParam,
  monthGridDays,
  parseISODate,
  parseMonthParam,
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

const CONTENT_TYPE_ICON: Readonly<Record<string, LucideIcon>> = {
  POST: FileText,
  STORY: ImageIcon,
  REEL: Film,
  VIDEO: Video,
  ARTICLE: Newspaper,
  EMAIL: Mail,
  AD: Megaphone,
  OTHER: FileText,
};

export default async function WorkspaceEditorialPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    world?: string;
    week?: string;
    view?: string;
    month?: string;
  }>;
}>) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");

  const { world, week, view, month } = await searchParams;
  const worldKey = world ?? "pixel-digital";
  const activeView =
    view === "pipeline" ? "pipeline" : view === "month" ? "month" : "week";
  const now = context.clock.now();
  const weekStart = parseISODate(week, now);
  const weekEnd = addDays(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );
  const monthStart = parseMonthParam(month, now);
  const monthEnd = addMonths(monthStart, 1);
  const monthCells = monthGridDays(monthStart);
  const canMutate = Boolean(
    context.actor?.role && MUTATE_ROLES.includes(context.actor.role),
  );

  // Both the week and month views only ever render their own fixed date
  // window -- bounding the query to that window keeps it from re-fetching
  // the world's entire editorial history just to bucket it by day in JS.
  // The pipeline view still needs the broader (unbounded) history to
  // surface anything stuck in an early status regardless of how long ago
  // it was scheduled; that's a known, separate scalability gap (see
  // AUDIT_EDITORIAL_TASKS_MODULE.md §3.1).
  const editorialWhere =
    activeView === "week"
      ? { worldKey, scheduledFor: { gte: weekStart, lt: addDays(weekEnd, 1) } }
      : activeView === "month"
        ? { worldKey, scheduledFor: { gte: monthStart, lt: monthEnd } }
        : { worldKey };

  const [items, clients, projects, users] = await Promise.all([
    prisma.editorialItem.findMany({
      where: editorialWhere,
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
  const previousMonthHref = `/workspace/editorial?world=${worldKey}&view=month&month=${formatMonthParam(addMonths(monthStart, -1))}`;
  const nextMonthHref = `/workspace/editorial?world=${worldKey}&view=month&month=${formatMonthParam(addMonths(monthStart, 1))}`;
  const monthLabel = monthStart.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

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
          href={`/workspace/editorial?world=${worldKey}&view=month`}
          role="tab"
          aria-selected={activeView === "month"}
          className={
            activeView === "month"
              ? "admin-tabs__item admin-tabs__item--active"
              : "admin-tabs__item"
          }
        >
          Mois
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
              contentTypeRaw: item.contentType,
              channel: item.channel,
              scheduledFor: formatDayLabel(item.scheduledFor),
              ownerName:
                item.owner?.displayName ?? item.owner?.normalizedEmail ?? null,
            }))}
          canMutate={canMutate}
          currentUserId={context.actor?.id}
          users={users.map((user) => ({
            id: user.id,
            name: user.displayName ?? user.normalizedEmail ?? "Collaborateur",
          }))}
          revalidatePathHint={`/workspace/editorial?world=${worldKey}`}
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
                    dayItems.map((item) => {
                      const ContentIcon =
                        CONTENT_TYPE_ICON[item.contentType] ?? FileText;
                      return (
                      <article
                        key={item.id}
                        className="editorial-card editorial-card--professional"
                      >
                        <div className="editorial-card__topline">
                          <StatusBadge kind="editorial" status={item.status} />
                          <span className="content-type-pill">
                            <ContentIcon size={12} strokeWidth={2} />
                            {CONTENT_LABEL[item.contentType]}
                          </span>
                        </div>
                        <p className="editorial-card__title">{item.title}</p>
                        <p className="editorial-card__meta">
                          {item.client?.name ?? item.clientLabel} · {item.channel}
                        </p>
                        {item.project || item.owner ? (
                          <div className="editorial-card__facts">
                            {item.project ? (
                              <span>
                                <FolderKanban size={12} strokeWidth={2} />
                                {item.project.name}
                              </span>
                            ) : null}
                            {item.owner ? (
                              <span>
                                <User size={12} strokeWidth={2} />
                                {item.owner.displayName ??
                                  item.owner.normalizedEmail}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        {item.brief ? (
                          <p className="editorial-card__brief">{item.brief}</p>
                        ) : null}
                        {item.statusChangeReason ? (
                          <p className="editorial-card__reason">
                            <CalendarClock size={12} strokeWidth={2} />
                            Motif : {item.statusChangeReason}
                          </p>
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
                        {context.actor ? (
                          <CommentThread
                            entityType="EDITORIAL_ITEM"
                            entityId={item.id}
                            currentUserId={context.actor.id}
                            users={users.map((user) => ({
                              id: user.id,
                              name:
                                user.displayName ??
                                user.normalizedEmail ??
                                "Collaborateur",
                            }))}
                            revalidatePathHint={`/workspace/editorial?world=${worldKey}`}
                          />
                        ) : null}
                      </article>
                      );
                    })
                  )}
                </section>
              );
            })}
          </div>
        </>
      ) : null}

      {activeView === "month" ? (
        <>
          <div className="editorial-week-nav">
            <Link href={previousMonthHref} className="admin-table__action">
              Mois précédent
            </Link>
            <span className="editorial-week-nav__label">{monthLabel}</span>
            <Link href={nextMonthHref} className="admin-table__action">
              Mois suivant
            </Link>
          </div>
          <div className="editorial-month-grid">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="editorial-month-grid__weekday">
                {label.slice(0, 3)}
              </div>
            ))}
            {monthCells.map((day, index) => {
              if (!day) {
                return (
                  <div
                    key={`blank-${index}`}
                    className="editorial-month-grid__day editorial-month-grid__day--blank"
                  />
                );
              }
              const key = formatISODate(day);
              const dayItems = itemsByDay.get(key) ?? [];
              return (
                <div key={key} className="editorial-month-grid__day">
                  <span className="editorial-month-grid__date">
                    {day.getUTCDate()}
                  </span>
                  {dayItems.slice(0, 3).map((item) => (
                    <Link
                      key={item.id}
                      href={`/workspace/editorial?world=${worldKey}&week=${formatISODate(day)}`}
                      className="editorial-month-grid__item"
                      title={item.title}
                    >
                      {item.title}
                    </Link>
                  ))}
                  {dayItems.length > 3 ? (
                    <Link
                      href={`/workspace/editorial?world=${worldKey}&week=${formatISODate(day)}`}
                      className="editorial-month-grid__more"
                    >
                      +{dayItems.length - 3}
                    </Link>
                  ) : null}
                </div>
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
