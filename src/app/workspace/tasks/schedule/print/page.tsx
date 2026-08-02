import { redirect } from "next/navigation";

import { getWorkspaceRequestContext } from "../../../get-workspace-context";
import { PrintButton } from "../../../billing/_components/print-button";
import {
  buildSchedule,
  parseScheduleParams,
  type ScheduleSearchParams,
} from "../_lib/schedule-query";

const PRIORITY_LABEL: Readonly<Record<string, string>> = {
  LOW: "Faible",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
};

const SCOPE_LABEL: Readonly<Record<string, string>> = {
  all: "Global",
  mine: "Mes tâches",
  users: "Utilisateur(s) sélectionné(s)",
};

export default async function TaskSchedulePrintPage({
  searchParams,
}: Readonly<{ searchParams: Promise<ScheduleSearchParams> }>) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");
  if (!context.actor || context.actor.role === "READER") {
    return <p role="alert">Accès refusé.</p>;
  }

  const parsed = parseScheduleParams(await searchParams);
  const { bounds, days } = await buildSchedule({
    worldKey: parsed.worldKey,
    range: parsed.range,
    anchor: parsed.anchor,
    scope: parsed.scope,
    currentUserId: context.actor.id,
    selectedUserIds: parsed.selectedUserIds,
    excludeAdmins: parsed.excludeAdmins,
  });

  const daysWithTasks = days.filter((day) => day.byAssignee.length > 0);

  return (
    <div className="invoice-print">
      <PrintButton />

      <header className="invoice-print__header">
        <div>
          <p className="invoice-print__brand">Planning des tâches</p>
          <p className="invoice-print__meta">{bounds.label}</p>
          <p className="invoice-print__meta">
            Portée : {SCOPE_LABEL[parsed.scope]}
            {parsed.scope === "all" && parsed.excludeAdmins
              ? " (hors administrateurs)"
              : ""}
          </p>
        </div>
      </header>

      {daysWithTasks.length === 0 ? (
        <p>Aucune tâche planifiée sur cette période.</p>
      ) : (
        daysWithTasks.map((day) => (
          <section key={day.dateIso}>
            <h2 className="admin-content__subtitle">{day.label}</h2>
            {day.byAssignee.map((group) => (
              <table key={group.assigneeName} className="invoice-print__table">
                <thead>
                  <tr>
                    <th colSpan={3}>{group.assigneeName}</th>
                  </tr>
                  <tr>
                    <th>Tâche</th>
                    <th>Projet</th>
                    <th>Priorité</th>
                  </tr>
                </thead>
                <tbody>
                  {group.tasks.map((task) => (
                    <tr key={task.id}>
                      <td>{task.title}</td>
                      <td>{task.projectName}</td>
                      <td>{PRIORITY_LABEL[task.priority] ?? task.priority}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
