"use client";

import { useActionState, useState } from "react";

import {
  Feedback,
  IDLE_ACTION_STATE,
  SubmitButton,
} from "../_components/feedback";
import { ConfirmAction } from "../_components/confirm-action";
import { EditPresence } from "../_components/edit-presence";
import { createProjectAction, updateProjectAction } from "./actions";

type Option = Readonly<{ value: string; label: string }>;

export function CreateProjectForm({
  worldKey,
  clients,
  users,
  teams,
}: Readonly<{
  worldKey: string;
  clients: Option[];
  users: Option[];
  teams: Option[];
}>) {
  const [state, action] = useActionState(
    createProjectAction,
    IDLE_ACTION_STATE,
  );
  return (
    <form action={action} className="admin-form-card">
      <input type="hidden" name="worldKey" value={worldKey} />
      <h2 className="admin-content__subtitle">Créer un projet</h2>
      <div className="admin-form-grid">
        <label>
          Nom
          <input name="name" required maxLength={160} />
        </label>
        <label>
          Client
          <select name="clientId" required>
            {clients.map((client) => (
              <option key={client.value} value={client.value}>
                {client.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Chef de projet
          <select name="projectManagerId" defaultValue="">
            <option value="">Non affecté</option>
            {users.map((user) => (
              <option key={user.value} value={user.value}>
                {user.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Équipe
          <select name="teamId" defaultValue="">
            <option value="">Non affectée</option>
            {teams.map((team) => (
              <option key={team.value} value={team.value}>
                {team.label}
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
          Budget (XOF)
          <input name="budget" type="number" min={0} step={1} />
        </label>
        <label>
          Début
          <input name="startDate" type="date" />
        </label>
        <label>
          Échéance
          <input name="dueDate" type="date" />
        </label>
      </div>
      <label>
        Description
        <textarea name="description" maxLength={1000} />
      </label>
      <Feedback state={state} />
      <SubmitButton>Créer le projet</SubmitButton>
    </form>
  );
}

export function UpdateProjectForm({
  projectId,
  status,
  progress,
  version,
  budgetCents,
}: Readonly<{
  projectId: string;
  status: string;
  progress: number;
  version: number;
  budgetCents: number | null;
}>) {
  const [state, action] = useActionState(
    updateProjectAction,
    IDLE_ACTION_STATE,
  );
  const [nextStatus, setNextStatus] = useState(status);
  const [editing, setEditing] = useState(false);
  return (
    <form
      action={action}
      className="project-card__controls"
      onFocusCapture={() => setEditing(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setEditing(false);
      }}
    >
      {editing ? (
        <EditPresence entityType="PROJECT" entityId={projectId} />
      ) : null}
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="expectedVersion" value={version} />
      <select
        name="status"
        value={nextStatus}
        onChange={(event) => setNextStatus(event.target.value)}
      >
        <option value="PLANNED">Planifié</option>
        <option value="ACTIVE">Actif</option>
        <option value="ON_HOLD">En pause</option>
        <option value="COMPLETED">Terminé</option>
        <option value="CANCELLED">Annulé</option>
      </select>
      <input
        name="progress"
        type="number"
        min={0}
        max={100}
        defaultValue={progress}
        aria-label="Progression en pourcentage"
      />
      <input
        name="budget"
        type="number"
        min={0}
        step={1}
        defaultValue={budgetCents ? budgetCents / 100 : ""}
        aria-label="Budget en XOF"
        placeholder="Budget (XOF)"
      />
      {nextStatus === "CANCELLED" && status !== "CANCELLED" ? (
        <ConfirmAction consequence="Le projet quittera les vues de production actives.">
          Annuler le projet
        </ConfirmAction>
      ) : (
        <SubmitButton>Mettre à jour</SubmitButton>
      )}
      <Feedback state={state} />
    </form>
  );
}
