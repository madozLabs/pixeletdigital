import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { listEditorialItemsByWorld } from "@/modules/editorial/application/editorial-item-use-cases";
import {
  isEditorialItemLate,
  type EditorialItem,
} from "@/modules/editorial/domain/editorial-item";
import { PrismaEditorialItemRepository } from "@/modules/editorial/infrastructure/prisma-editorial-item-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";
import type { ApprovedRole } from "@/shared/request-context";

import { EditorialStatusBadge } from "../_components/status-badge";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import {
  cancelEditorialItemAction,
  createEditorialItemAction,
  markEditorialItemDoneAction,
} from "./actions";
import {
  addDays,
  formatISODate,
  parseISODate,
  WEEKDAY_LABELS,
} from "./_lib/week";

const WORLDS = [
  { key: "pixel-digital", label: "Pixel&Digital" },
  { key: "kwaliti-print", label: "Kwaliti Print" },
];

const MUTATE_ROLES: readonly ApprovedRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "WORLD_MANAGER",
  "EDITOR",
];

export default async function WorkspaceEditorialPage({
  searchParams,
}: {
  searchParams: Promise<{ world?: string; week?: string }>;
}) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");

  const { world, week } = await searchParams;
  const worldKey = world ?? WORLDS[0]!.key;
  const now = context.clock.now();
  const weekStart = parseISODate(week, now);
  const weekEnd = addDays(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );

  const deps = {
    editorialItems: new PrismaEditorialItemRepository(prisma),
    worlds: new PrismaWorldRepository(prisma),
  };

  const result = await listEditorialItemsByWorld(deps, context, { worldKey });

  if (!result.ok) {
    return (
      <>
        <h1 className="admin-content__title">Calendrier éditorial</h1>
        <p role="alert">{result.error.message}</p>
      </>
    );
  }

  const items = result.value;
  const canMutate =
    context.actor?.role !== null &&
    context.actor?.role !== undefined &&
    MUTATE_ROLES.includes(context.actor.role);

  const itemsByDay = new Map<string, EditorialItem[]>();
  for (const item of items) {
    const key = formatISODate(item.scheduledFor);
    const bucket = itemsByDay.get(key) ?? [];
    bucket.push(item);
    itemsByDay.set(key, bucket);
  }

  const realizations = [...items]
    .filter((item) => item.status === "DONE" && item.realizedAt)
    .sort(
      (a, b) => (b.realizedAt?.getTime() ?? 0) - (a.realizedAt?.getTime() ?? 0),
    )
    .slice(0, 20);

  const previousWeekHref = `/workspace/editorial?world=${worldKey}&week=${formatISODate(addDays(weekStart, -7))}`;
  const nextWeekHref = `/workspace/editorial?world=${worldKey}&week=${formatISODate(addDays(weekStart, 7))}`;

  return (
    <>
      <h1 className="admin-content__title">Calendrier éditorial</h1>

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
            <div key={key} className="editorial-board__day">
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
                  <div key={item.id} className="editorial-card">
                    <EditorialStatusBadge
                      status={item.status}
                      isLate={isEditorialItemLate(item, now)}
                    />
                    <p className="editorial-card__title">{item.title}</p>
                    <p className="editorial-card__meta">
                      {item.clientLabel} · {item.channel}
                    </p>
                    {item.status === "DONE" && item.proofUrl ? (
                      <a
                        href={item.proofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="editorial-card__proof"
                      >
                        Voir la preuve
                      </a>
                    ) : null}
                    {item.status === "PLANNED" && canMutate ? (
                      <div className="editorial-card__actions">
                        <form
                          action={markEditorialItemDoneAction}
                          className="editorial-card__done-form"
                        >
                          <input type="hidden" name="id" value={item.id} />
                          <input
                            type="hidden"
                            name="expectedVersion"
                            value={item.version}
                          />
                          <input
                            type="url"
                            name="proofUrl"
                            placeholder="Lien de preuve (post, pub)"
                            required
                            className="editorial-card__proof-input"
                          />
                          <button type="submit" className="admin-table__action">
                            Marquer fait
                          </button>
                        </form>
                        <form action={cancelEditorialItemAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input
                            type="hidden"
                            name="expectedVersion"
                            value={item.version}
                          />
                          <button type="submit" className="admin-table__action">
                            Annuler
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>

      {canMutate ? (
        <>
          <h2 className="admin-content__subtitle">Planifier une publication</h2>
          <form action={createEditorialItemAction} className="editorial-form">
            <input type="hidden" name="worldKey" value={worldKey} />
            <label>
              Client
              <input type="text" name="clientLabel" required maxLength={120} />
            </label>
            <label>
              Canal
              <input
                type="text"
                name="channel"
                required
                maxLength={60}
                placeholder="Instagram, Facebook…"
              />
            </label>
            <label>
              Titre
              <input type="text" name="title" required maxLength={160} />
            </label>
            <label>
              Date prévue
              <input
                type="date"
                name="scheduledFor"
                required
                defaultValue={formatISODate(weekStart)}
              />
            </label>
            <label>
              Notes
              <input type="text" name="notes" maxLength={500} />
            </label>
            <button type="submit" className="admin-table__action">
              Ajouter au calendrier
            </button>
          </form>
        </>
      ) : null}

      <h2 className="admin-content__subtitle">Journal des réalisations</h2>
      {realizations.length === 0 ? (
        <p className="admin-empty">
          Aucune réalisation enregistrée pour cet univers.
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Canal</th>
                <th>Titre</th>
                <th>Preuve</th>
              </tr>
            </thead>
            <tbody>
              {realizations.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.realizedAt ? formatDayLabel(item.realizedAt) : ""}
                  </td>
                  <td>{item.clientLabel}</td>
                  <td>{item.channel}</td>
                  <td>{item.title}</td>
                  <td>
                    {item.proofUrl ? (
                      <a
                        href={item.proofUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Lien
                      </a>
                    ) : (
                      <span className="admin-table__note">Aucun lien</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
