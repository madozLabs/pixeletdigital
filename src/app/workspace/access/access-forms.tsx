"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  assignRoleAction,
  createEmployeeAction,
  revokeRoleAction,
  setUserStatusAction,
  type AccessActionState,
} from "./actions";

const initialState: AccessActionState = { status: "idle" };

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
function Feedback({ state }: Readonly<{ state: AccessActionState }>) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p
      className={
        state.status === "success"
          ? "admin-feedback admin-feedback--success"
          : "admin-feedback admin-feedback--error"
      }
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.message}
    </p>
  );
}

function SubmitButton({ children }: Readonly<{ children: string }>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="admin-table__action" disabled={pending}>
      {pending ? "Traitement…" : children}
    </button>
  );
}

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
  const [state, action] = useActionState(createEmployeeAction, initialState);
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
  const [state, action] = useActionState(setUserStatusAction, initialState);
  const nextStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  return (
    <form action={action} className="admin-inline-form">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={nextStatus} />
      <SubmitButton>
        {nextStatus === "ACTIVE" ? "Activer" : "Suspendre"}
      </SubmitButton>
      <Feedback state={state} />
    </form>
  );
}
export function AssignRoleForm({ userId }: Readonly<{ userId: string }>) {
  const [state, action] = useActionState(assignRoleAction, initialState);
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
  const [state, action] = useActionState(revokeRoleAction, initialState);
  return (
    <form action={action} className="admin-inline-form">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <SubmitButton>Révoquer</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}
