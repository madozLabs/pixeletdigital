"use client";

import { useActionState, useState } from "react";

import {
  Feedback,
  IDLE_ACTION_STATE,
  SubmitButton,
} from "../_components/feedback";
import { createTaskAction } from "./actions";

type Option = Readonly<{ id: string; label: string }>;

const DEPENDENCY_DATALIST_ID = "create-task-dependency-options";

export function CreateTaskForm({
  activeProjectId,
  users,
  tasks,
}: Readonly<{
  activeProjectId: string;
  users: Option[];
  tasks: Option[];
}>) {
  const [state, action] = useActionState(createTaskAction, IDLE_ACTION_STATE);
  const [dependencyQuery, setDependencyQuery] = useState("");
  const matchedDependency = tasks.find(
    (task) => task.label === dependencyQuery,
  );
  return (
    <form action={action} className="admin-form-card">
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
                {user.label}
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
                {task.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dépend de
          <input
            list={DEPENDENCY_DATALIST_ID}
            value={dependencyQuery}
            onChange={(event) => setDependencyQuery(event.target.value)}
            placeholder="Rechercher une tâche…"
            autoComplete="off"
          />
          <datalist id={DEPENDENCY_DATALIST_ID}>
            {tasks.map((task) => (
              <option key={task.id} value={task.label} />
            ))}
          </datalist>
          <input
            type="hidden"
            name="dependencyTaskId"
            value={matchedDependency?.id ?? ""}
          />
        </label>
      </div>
      <label>
        Description
        <textarea name="description" maxLength={1000} />
      </label>
      <Feedback state={state} />
      <SubmitButton>Créer la tâche</SubmitButton>
    </form>
  );
}
