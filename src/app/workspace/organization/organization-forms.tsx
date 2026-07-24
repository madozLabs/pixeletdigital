"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  assignMemberAction,
  createDepartmentAction,
  createPositionAction,
  createTeamAction,
  type OrganizationActionState,
} from "./actions";

const initialState: OrganizationActionState = { status: "idle" };

type Option = Readonly<{ value: string; label: string }>;

function Feedback({ state }: Readonly<{ state: OrganizationActionState }>) {
  if (!state.message || state.status === "idle") return null;
  return (
    <p
      className={`admin-feedback admin-feedback--${state.status}`}
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.message}
    </p>
  );
}
function SubmitButton({ children }: Readonly<{ children: string }>) {
  const { pending } = useFormStatus();
  return (
    <button className="admin-table__action" type="submit" disabled={pending}>
      {pending ? "Traitement…" : children}
    </button>
  );
}

export function DepartmentForm() {
  const [state, action] = useActionState(createDepartmentAction, initialState);
  return (
    <form action={action} className="admin-form-card">
      <h2 className="admin-content__subtitle">Nouveau département</h2>
      <div className="admin-form-grid">
        <label>
          Nom
          <input name="name" required maxLength={100} />
        </label>
        <label>
          Description
          <input name="description" maxLength={240} />
        </label>
      </div>
      <Feedback state={state} />
      <SubmitButton>Créer le département</SubmitButton>
    </form>
  );
}

export function PositionForm() {
  const [state, action] = useActionState(createPositionAction, initialState);
  return (
    <form action={action} className="admin-form-card">
      <h2 className="admin-content__subtitle">Nouveau poste</h2>
      <div className="admin-form-grid">
        <label>
          Intitulé
          <input name="title" required maxLength={100} />
        </label>
        <label>
          Description
          <input name="description" maxLength={240} />
        </label>
      </div>
      <Feedback state={state} />
      <SubmitButton>Créer le poste</SubmitButton>
    </form>
  );
}

export function TeamForm({ departments }: Readonly<{ departments: Option[] }>) {
  const [state, action] = useActionState(createTeamAction, initialState);
  return (
    <form action={action} className="admin-form-card">
      <h2 className="admin-content__subtitle">Nouvelle équipe</h2>
      <div className="admin-form-grid">
        <label>
          Département
          <select name="departmentId" required>
            {departments.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nom
          <input name="name" required maxLength={100} />
        </label>
        <label>
          Description
          <input name="description" maxLength={240} />
        </label>
      </div>
      <Feedback state={state} />
      <SubmitButton>Créer l&apos;équipe</SubmitButton>
    </form>
  );
}
export function MembershipForm({
  users,
  teams,
  positions,
}: Readonly<{ users: Option[]; teams: Option[]; positions: Option[] }>) {
  const [state, action] = useActionState(assignMemberAction, initialState);
  return (
    <form action={action} className="admin-form-card">
      <h2 className="admin-content__subtitle">Affecter un collaborateur</h2>
      <div className="admin-form-grid">
        <label>
          Collaborateur
          <select name="userId" required>
            {users.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Équipe
          <select name="teamId" required>
            {teams.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Poste
          <select name="jobPositionId">
            <option value="">Aucun poste</option>
            {positions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="admin-confirmation">
        <input type="checkbox" name="isPrimary" /> Équipe principale
      </label>
      <Feedback state={state} />
      <SubmitButton>Affecter</SubmitButton>
    </form>
  );
}
