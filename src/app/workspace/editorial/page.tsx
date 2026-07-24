import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import type { ApprovedRole } from "@/shared/request-context";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import {
  advanceEditorialWorkflowAction,
  createProfessionalEditorialItemAction,
} from "./professional-actions";
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

const STATUS_LABEL: Readonly<Record<string, string>> = {
  DRAFT: "Brouillon",
  INTERNAL_REVIEW: "Validation interne",
  CLIENT_REVIEW: "Validation client",
  APPROVED: "Approuvé",
  SCHEDULED: "Programmé",
  PUBLISHED: "Publié",
  CANCELLED: "Annulé",
};
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
}: Readonly<{ searchParams: Promise<{ world?: string; week?: string }> }>) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");

  const { world, week } = await searchParams;
  const worldKey = world ?? "pixel-digital";
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
        <span className="admin-metric">{items.length} contenus</span>
      </div>

      <div className="editorial-week-nav">
        <Link href={previousWeekHref} className="admin-table__action">
          Semaine précédente
        </Link>
        <span className="editorial-week-nav__label">
          Semaine du {formatDayLabel(weekStart)} au {formatDayLabel(weekEnd)}
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
                    <span
                      className={`status-badge status-badge--${item.status.toLowerCase()}`}
                    >
                      {STATUS_LABEL[item.status]}
                    </span>
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
                        {item.owner.displayName ?? item.owner.normalizedEmail}
                      </p>
                    ) : null}
                    {item.brief ? (
                      <p className="editorial-card__brief">{item.brief}</p>
                    ) : null}
                    {canMutate &&
                    item.status !== "PUBLISHED" &&
                    item.status !== "CANCELLED" ? (
                      <form
                        action={advanceEditorialWorkflowAction}
                        className="editorial-card__workflow"
                      >
                        <input type="hidden" name="itemId" value={item.id} />
                        <select name="status" defaultValue={item.status}>
                          <option value="DRAFT">Brouillon</option>
                          <option value="INTERNAL_REVIEW">
                            Validation interne
                          </option>
                          <option value="CLIENT_REVIEW">
                            Validation client
                          </option>
                          <option value="APPROVED">Approuvé</option>
                          <option value="SCHEDULED">Programmé</option>
                          <option value="PUBLISHED">Publié</option>
                          <option value="CANCELLED">Annulé</option>
                        </select>
                        <input
                          name="proofUrl"
                          type="url"
                          placeholder="Lien de publication"
                        />
                        <button type="submit" className="admin-table__action">
                          Mettre à jour
                        </button>
                      </form>
                    ) : null}
                  </article>
                ))
              )}
            </section>
          );
        })}
      </div>

      {canMutate ? (
        <form
          action={createProfessionalEditorialItemAction}
          className="admin-form-card editorial-professional-form"
        >
          <input type="hidden" name="worldKey" value={worldKey} />
          <h2 className="admin-content__subtitle">Planifier un contenu</h2>
          <div className="admin-form-grid">
            <label>
              Client
              <select name="clientId" defaultValue="">
                <option value="">Sans client lié</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Projet
              <select name="projectId" defaultValue="">
                <option value="">Sans projet lié</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Responsable
              <select name="ownerId" defaultValue="">
                <option value="">Non affecté</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName ?? user.normalizedEmail}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Validateur
              <select name="reviewerId" defaultValue="">
                <option value="">Non affecté</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName ?? user.normalizedEmail}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Client libre
              <input
                name="clientLabel"
                maxLength={120}
                placeholder="Utilisé sans client lié"
              />
            </label>
            <label>
              Canal
              <input
                name="channel"
                required
                maxLength={60}
                placeholder="Instagram, Facebook…"
              />
            </label>
            <label>
              Type
              <select name="contentType" defaultValue="POST">
                {Object.entries(CONTENT_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Titre
              <input name="title" required maxLength={160} />
            </label>
            <label>
              Fin de production
              <input name="productionDueAt" type="date" />
            </label>
            <label>
              Publication
              <input
                name="scheduledFor"
                type="date"
                required
                defaultValue={formatISODate(weekStart)}
              />
            </label>
          </div>
          <label>
            Brief
            <textarea name="brief" maxLength={2000} />
          </label>
          <label>
            Notes
            <textarea name="notes" maxLength={1000} />
          </label>
          <button type="submit" className="admin-table__action">
            Créer le contenu
          </button>
        </form>
      ) : null}
    </>
  );
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}
