import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getWorkspaceRequestContext } from "../../get-workspace-context";
import {
  buildSchedule,
  parseScheduleParams,
  scheduleQueryString,
  type ScheduleSearchParams,
} from "./_lib/schedule-query";

const PRIORITY_LABEL: Readonly<Record<string, string>> = {
  LOW: "Faible",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
};

export default async function TaskSchedulePage({
  searchParams,
}: Readonly<{ searchParams: Promise<ScheduleSearchParams> }>) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");
  if (!context.actor || context.actor.role === "READER") {
    return <p role="alert">Vous n&apos;êtes pas autorisé à consulter le planning.</p>;
  }

  const rawParams = await searchParams;
  const parsed = parseScheduleParams(rawParams);

  const [users, { bounds, days }] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { displayName: "asc" },
    }),
    buildSchedule({
      worldKey: parsed.worldKey,
      range: parsed.range,
      anchor: parsed.anchor,
      scope: parsed.scope,
      currentUserId: context.actor.id,
      selectedUserIds: parsed.selectedUserIds,
      excludeAdmins: parsed.excludeAdmins,
    }),
  ]);

  const printQuery = scheduleQueryString(parsed);

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-content__title">Planning des tâches</h1>
          <p className="admin-content__lede">{bounds.label}</p>
        </div>
        <Link
          className="admin-table__action"
          href={`/workspace/tasks/schedule/print?${printQuery}`}
          target="_blank"
        >
          Imprimer
        </Link>
      </div>

      <form className="admin-form-card" method="get">
        <input type="hidden" name="world" value={parsed.worldKey} />
        <label>
          Période
          <select name="range" defaultValue={parsed.range}>
            <option value="day">Jour</option>
            <option value="week">Semaine</option>
            <option value="month">Mois</option>
          </select>
        </label>
        <label>
          Date de référence
          <input name="date" type="date" defaultValue={parsed.dateParam} />
        </label>
        <label>
          Portée
          <select name="scope" defaultValue={parsed.scope}>
            <option value="all">Global</option>
            <option value="mine">Mes tâches</option>
            <option value="users">Utilisateur(s) précis</option>
          </select>
        </label>
        <label className="admin-form-card__checkbox">
          <input
            type="checkbox"
            name="excludeAdmin"
            value="1"
            defaultChecked={parsed.excludeAdmins}
          />
          Exclure les administrateurs (portée globale)
        </label>
        <fieldset className="admin-form-card__fieldset">
          <legend>Utilisateurs (si portée = utilisateur(s) précis)</legend>
          {users.map((user) => (
            <label key={user.id} className="admin-form-card__checkbox">
              <input
                type="checkbox"
                name="users"
                value={user.id}
                defaultChecked={parsed.selectedUserIds.includes(user.id)}
              />
              {user.displayName ?? user.normalizedEmail ?? "Collaborateur"}
            </label>
          ))}
        </fieldset>
        <button className="admin-table__action" type="submit">
          Afficher
        </button>
      </form>

      {days.every((day) => day.byAssignee.length === 0) ? (
        <p className="admin-empty">Aucune tâche planifiée sur cette période.</p>
      ) : (
        days
          .filter((day) => day.byAssignee.length > 0)
          .map((day) => (
            <section key={day.dateIso} className="admin-content-block">
              <h2 className="admin-content__subtitle">{day.label}</h2>
              {day.byAssignee.map((group) => (
                <div key={group.assigneeName} className="admin-form-card">
                  <h3>{group.assigneeName}</h3>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Tâche</th>
                        <th>Projet</th>
                        <th>Priorité</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.tasks.map((task) => (
                        <tr key={task.id}>
                          <td>{task.title}</td>
                          <td>{task.projectName}</td>
                          <td>{PRIORITY_LABEL[task.priority] ?? task.priority}</td>
                          <td>{task.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </section>
          ))
      )}
    </>
  );
}
