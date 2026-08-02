"use client";

import { useActionState, useState } from "react";

import {
  Feedback,
  IDLE_ACTION_STATE,
  SubmitButton,
} from "../_components/feedback";
import { ConfirmAction } from "../_components/confirm-action";
import {
  advanceEditorialWorkflowAction,
  createProfessionalEditorialItemAction,
} from "./professional-actions";

type Option = Readonly<{ id: string; label: string }>;

// Mirrors professional-actions.ts's EDITORIAL_STATUS_ORDER -- used only to
// decide whether to show the reason field, not to validate the transition.
const EDITORIAL_STATUS_ORDER = [
  "DRAFT",
  "INTERNAL_REVIEW",
  "CLIENT_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
] as const;

function isBackwardTransition(from: string, to: string): boolean {
  if (to === "CANCELLED") return true;
  const fromIndex = EDITORIAL_STATUS_ORDER.indexOf(
    from as (typeof EDITORIAL_STATUS_ORDER)[number],
  );
  const toIndex = EDITORIAL_STATUS_ORDER.indexOf(
    to as (typeof EDITORIAL_STATUS_ORDER)[number],
  );
  return fromIndex >= 0 && toIndex >= 0 && toIndex < fromIndex;
}

const CONTENT_TYPE_LABEL: Readonly<Record<string, string>> = {
  POST: "Post",
  STORY: "Story",
  REEL: "Reel",
  VIDEO: "Vidéo",
  ARTICLE: "Article",
  EMAIL: "E-mail",
  AD: "Publicité",
  OTHER: "Autre",
};

export function EditorialWorkflowForm({
  itemId,
  version,
  status,
}: Readonly<{ itemId: string; version: number; status: string }>) {
  const [state, action] = useActionState(
    advanceEditorialWorkflowAction,
    IDLE_ACTION_STATE,
  );
  const [nextStatus, setNextStatus] = useState(status);
  return (
    <form action={action} className="editorial-card__workflow">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="expectedVersion" value={version} />
      <select
        name="status"
        value={nextStatus}
        onChange={(event) => setNextStatus(event.target.value)}
      >
        <option value="DRAFT">Brouillon</option>
        <option value="INTERNAL_REVIEW">Validation interne</option>
        <option value="CLIENT_REVIEW">Validation client</option>
        <option value="APPROVED">Approuvé</option>
        <option value="SCHEDULED">Programmé</option>
        <option value="PUBLISHED">Publié</option>
        <option value="CANCELLED">Annulé</option>
      </select>
      <input name="proofUrl" type="url" placeholder="Lien de publication" />
      {isBackwardTransition(status, nextStatus) ? (
        <label>
          Motif
          <textarea
            name="reason"
            maxLength={500}
            placeholder="Pourquoi ce retour en arrière ou cette annulation ?"
          />
        </label>
      ) : null}
      {nextStatus === "CANCELLED" && status !== "CANCELLED" ? (
        <ConfirmAction consequence="Ce contenu quittera définitivement le pipeline éditorial actif.">
          Annuler le contenu
        </ConfirmAction>
      ) : (
        <SubmitButton>Mettre à jour</SubmitButton>
      )}
      <Feedback state={state} />
    </form>
  );
}

export function CreateEditorialItemForm({
  worldKey,
  clients,
  projects,
  users,
  pages,
  defaultScheduledFor,
}: Readonly<{
  worldKey: string;
  clients: Option[];
  projects: Option[];
  users: Option[];
  pages: Option[];
  defaultScheduledFor: string;
}>) {
  const [state, action] = useActionState(
    createProfessionalEditorialItemAction,
    IDLE_ACTION_STATE,
  );
  return (
    <form
      action={action}
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
                {client.label}
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
                {project.label}
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
                {user.label}
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
                {user.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Page du site liée
          <select name="linkedPageId" defaultValue="">
            <option value="">Sans page liée</option>
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.label}
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
            {Object.entries(CONTENT_TYPE_LABEL).map(([value, label]) => (
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
            defaultValue={defaultScheduledFor}
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
      <Feedback state={state} />
      <SubmitButton>Créer le contenu</SubmitButton>
    </form>
  );
}
