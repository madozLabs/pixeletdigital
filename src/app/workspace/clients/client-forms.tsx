"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  addClientContactAction,
  createProfessionalClientAction,
  type ClientActionState,
} from "./actions";

const initialState: ClientActionState = { status: "idle" };
type Option = Readonly<{ value: string; label: string }>;

function Feedback({ state }: Readonly<{ state: ClientActionState }>) {
  if (state.status === "idle" || !state.message) return null;
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
    <button className="admin-table__action" disabled={pending}>
      {pending ? "Traitement…" : children}
    </button>
  );
}
export function CreateClientForm({
  worldKey,
  users,
  teams,
}: Readonly<{ worldKey: string; users: Option[]; teams: Option[] }>) {
  const [state, action] = useActionState(
    createProfessionalClientAction,
    initialState,
  );
  return (
    <form action={action} className="admin-form-card">
      <input type="hidden" name="worldKey" value={worldKey} />
      <h2 className="admin-content__subtitle">Créer un compte client</h2>
      <div className="admin-form-grid">
        <label>
          Nom commercial
          <input name="name" required maxLength={160} />
        </label>
        <label>
          Raison sociale
          <input name="legalName" maxLength={180} />
        </label>
        <label>
          Secteur
          <input name="industry" maxLength={120} />
        </label>
        <label>
          E-mail
          <input name="email" type="email" maxLength={254} />
        </label>
        <label>
          Téléphone
          <input name="phone" maxLength={40} />
        </label>
        <label>
          Site web
          <input name="website" type="url" maxLength={240} />
        </label>
        <label>
          Logo (URL)
          <input name="logoUrl" type="url" maxLength={500} />
        </label>
        <label>
          Adresse
          <input name="address" maxLength={240} />
        </label>
      </div>{" "}
      <div className="admin-form-grid">
        <label>
          Responsable de compte
          <select name="accountManagerId">
            <option value="">Non affecté</option>
            {users.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Responsable commercial
          <select name="commercialOwnerId">
            <option value="">Non affecté</option>
            {users.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Équipe affectée
          <select name="teamId">
            <option value="">Non affectée</option>
            {teams.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Notes
        <textarea name="notes" maxLength={1200} rows={4} />
      </label>
      <Feedback state={state} />
      <SubmitButton>Créer le client</SubmitButton>
    </form>
  );
}

export function ClientContactForm({
  clientId,
}: Readonly<{ clientId: string }>) {
  const [state, action] = useActionState(addClientContactAction, initialState);
  return (
    <form action={action} className="admin-form-card admin-form-card--compact">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="admin-form-grid">
        <label>
          Nom
          <input name="name" required maxLength={160} />
        </label>
        <label>
          Fonction
          <input name="role" maxLength={120} />
        </label>
        <label>
          E-mail
          <input name="email" type="email" maxLength={254} />
        </label>
        <label>
          Téléphone
          <input name="phone" maxLength={40} />
        </label>
      </div>
      <label className="admin-confirmation">
        <input name="isPrimary" type="checkbox" /> Contact principal
      </label>
      <Feedback state={state} />
      <SubmitButton>Ajouter le contact</SubmitButton>
    </form>
  );
}
