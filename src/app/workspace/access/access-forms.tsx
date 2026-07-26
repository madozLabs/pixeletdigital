"use client";

import { useActionState } from "react";

import {
  Feedback,
  IDLE_ACTION_STATE,
  SubmitButton,
} from "../_components/feedback";
import { ConfirmAction } from "../_components/confirm-action";
import {
  assignRoleAction,
  createEmployeeAction,
  revokeRoleAction,
  setUserStatusAction,
} from "./actions";

const ROLES = [
  ["SUPER_ADMIN", "Super Admin"],
  ["ADMIN", "Administrateur"],
  ["WORLD_MANAGER", "Responsable de marque"],
  ["EDITOR", "Éditeur"],
  ["SALES", "Commercial"],
  ["CONTRIBUTOR", "Collaborateur"],
  ["READER", "Lecteur"],
] as const;

const WORLDS = [
  ["pixel-digital", "Pixel&Digital"],
  ["kwaliti-print", "Kwaliti Print"],
] as const;
function RoleFields({ prefix = "" }: Readonly<{ prefix?: string }>) {
  return (
    <>
      <label>
        Rôle
        <select name={`${prefix}role`} defaultValue="CONTRIBUTOR">
          {ROLES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Périmètre
        <select name={`${prefix}scopeType`} defaultValue="WORLD">
          <option value="WORLD">Un univers</option>
          <option value="GLOBAL">Toute l&apos;organisation</option>
        </select>
      </label>
      <label>
        Univers
        <select name={`${prefix}worldKey`} defaultValue="pixel-digital">
          {WORLDS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
export function CreateEmployeeForm() {
  const [state, action] = useActionState(
    createEmployeeAction,
    IDLE_ACTION_STATE,
  );
  return (
    <form action={action} className="admin-form-card">
      <h2 className="admin-content__subtitle">Créer un profil</h2>
      <div className="admin-form-grid">
        <label>
          Nom complet
          <input name="displayName" required maxLength={160} />
        </label>
        <label>
          E-mail professionnel
          <input name="email" type="email" required maxLength={254} />
        </label>
        <label>
          Mot de passe temporaire
          <input name="password" type="password" required minLength={12} />
        </label>
        <RoleFields />
      </div>
      <label className="admin-confirmation">
        <input name="confirmed" type="checkbox" required />
        Je confirme la création de ce compte et de son accès initial.
      </label>
      <Feedback state={state} />
      <SubmitButton>Créer le profil</SubmitButton>
    </form>
  );
}

export function UserStatusForm({
  userId,
  currentStatus,
}: Readonly<{ userId: string; currentStatus: "ACTIVE" | "INACTIVE" }>) {
  const [state, action] = useActionState(
    setUserStatusAction,
    IDLE_ACTION_STATE,
  );
  const nextStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  return (
    <form action={action} className="admin-inline-form">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={nextStatus} />
      {nextStatus === "ACTIVE" ? (
        <SubmitButton>Activer</SubmitButton>
      ) : (
        <ConfirmAction consequence="Le compte ne pourra plus accéder au Workspace jusqu’à sa réactivation.">
          Suspendre
        </ConfirmAction>
      )}
      <Feedback state={state} />
    </form>
  );
}
export function AssignRoleForm({ userId }: Readonly<{ userId: string }>) {
  const [state, action] = useActionState(assignRoleAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="admin-form-card admin-form-card--compact">
      <input type="hidden" name="userId" value={userId} />
      <div className="admin-form-grid">
        <RoleFields />
      </div>
      <label className="admin-confirmation">
        <input name="confirmed" type="checkbox" required />
        Je confirme cette nouvelle autorisation.
      </label>
      <Feedback state={state} />
      <SubmitButton>Attribuer le rôle</SubmitButton>
    </form>
  );
}

export function RevokeRoleForm({
  assignmentId,
}: Readonly<{ assignmentId: string }>) {
  const [state, action] = useActionState(revokeRoleAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="admin-inline-form">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <ConfirmAction consequence="Cette autorisation sera retirée immédiatement à l’utilisateur.">
        Révoquer
      </ConfirmAction>
      <Feedback state={state} />
    </form>
  );
}
