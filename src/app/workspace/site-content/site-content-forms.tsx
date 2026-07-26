"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  Feedback,
  IDLE_ACTION_STATE,
  SubmitButton,
} from "../_components/feedback";
import { ConfirmAction } from "../_components/confirm-action";
import {
  createPageAction,
  deleteMediaAction,
  deleteSectionAction,
  saveSectionAction,
  saveSectionFieldsAction,
  transitionPageAction,
  updatePageAction,
  uploadMediaAction,
} from "./actions";

const SECTION_TYPES = [
  "HERO",
  "TEXT",
  "MEDIA",
  "GALLERY",
  "STATS",
  "TESTIMONIALS",
  "TESTIMONIAL",
  "CASE_STUDY",
  "CTA",
  "PORTFOLIO",
];

export function CreatePageForm({ worldKey }: Readonly<{ worldKey: string }>) {
  const [state, action] = useActionState(createPageAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="admin-form-card cms-create-card">
      <h2>Nouvelle page</h2>
      <input type="hidden" name="worldKey" value={worldKey} />
      <label>
        Titre
        <input name="title" required maxLength={160} />
      </label>
      <label>
        Slug
        <input name="slug" required placeholder="notre-agence" />
      </label>
      <label>
        Type
        <select name="pageType">
          <option>LANDING</option>
          <option>STANDARD</option>
          <option>PORTFOLIO</option>
        </select>
      </label>
      <Feedback state={state} />
      <SubmitButton>Créer la page</SubmitButton>
      <p className="section__note">
        Le slug « accueil » pilote le hero du site public de l’univers.
      </p>
    </form>
  );
}

export function UpdatePageForm({
  id,
  version,
  title,
  slug,
  editable,
}: Readonly<{
  id: string;
  version: number;
  title: string;
  slug: string;
  editable: boolean;
}>) {
  const [state, action] = useActionState(updatePageAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="admin-form-card">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="expectedVersion" value={version} />
      <div className="admin-form-grid">
        <label>
          Titre
          <input name="title" defaultValue={title} required />
        </label>
        <label>
          Slug
          <input name="slug" defaultValue={slug} required />
        </label>
      </div>
      <Feedback state={state} />
      <SubmitButton>Enregistrer</SubmitButton>
      {!editable ? (
        <p className="admin-table__note">
          Cette page n&apos;est plus en brouillon.
        </p>
      ) : null}
    </form>
  );
}

export function DeleteSectionForm({
  sectionId,
}: Readonly<{ sectionId: string }>) {
  const [state, action] = useActionState(
    deleteSectionAction,
    IDLE_ACTION_STATE,
  );
  return (
    <form action={action}>
      <input type="hidden" name="id" value={sectionId} />
      <ConfirmAction consequence="Cette section sera supprimée définitivement de la page.">
        Supprimer
      </ConfirmAction>
      <Feedback state={state} />
    </form>
  );
}

type ImageOption = Readonly<{
  id: string;
  publicUrl: string;
  altText: string;
  title: string;
}>;

export function SectionFieldsForm({
  sectionId,
  version,
  pageId,
  sectionType,
  order,
  eyebrow,
  title,
  text,
  label,
  href,
  mediaId,
  images,
  worldKey,
  editable,
  evidencePayload,
}: Readonly<{
  sectionId: string;
  version: number;
  pageId: string;
  sectionType: string;
  order: number;
  eyebrow: string;
  title: string;
  text: string;
  label: string;
  href: string;
  mediaId: string;
  images: readonly ImageOption[];
  worldKey: string;
  editable: boolean;
  evidencePayload: Readonly<Record<string, unknown>>;
}>) {
  const [state, action] = useActionState(
    saveSectionFieldsAction,
    IDLE_ACTION_STATE,
  );
  return (
    <form action={action}>
      <input type="hidden" name="id" value={sectionId} />
      <input type="hidden" name="expectedVersion" value={version} />
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="sectionType" value={sectionType} />
      {sectionType === "CASE_STUDY" || sectionType === "TESTIMONIAL" ? (
        <EvidenceFields sectionType={sectionType} payload={evidencePayload} />
      ) : null}
      <div className="admin-form-grid">
        <label>
          Ordre
          <input type="number" name="order" min="0" defaultValue={order} />
        </label>
        <label>
          Sur-titre
          <input name="eyebrow" defaultValue={eyebrow} />
        </label>
      </div>
      <label>
        Titre{" "}
        {sectionType === "HERO" ? "(une ligne par retour à la ligne)" : ""}
        <textarea name="title" rows={3} defaultValue={title} />
      </label>
      <label>
        Texte
        <textarea name="text" rows={3} defaultValue={text} />
      </label>
      <div className="admin-form-grid">
        <label>
          Libellé du bouton
          <input name="label" defaultValue={label} />
        </label>
        <label>
          Lien du bouton
          <input name="href" defaultValue={href} />
        </label>
      </div>
      <span className="cms-picker-label">Image</span>
      {images.length === 0 ? (
        <p className="admin-empty">
          Aucun média disponible.{" "}
          <Link href={`/workspace/site-content?world=${worldKey}&tab=media`}>
            Ajoutez-en un dans la médiathèque
          </Link>
          , il apparaîtra ici.
        </p>
      ) : (
        <div className="cms-image-picker" role="radiogroup">
          <label className="cms-image-picker__tile cms-image-picker__tile--empty">
            <input
              type="radio"
              name="mediaId"
              value=""
              defaultChecked={mediaId === ""}
              disabled={!editable}
            />
            <span>Aucune image</span>
          </label>
          {images.map((asset) => (
            <label className="cms-image-picker__tile" key={asset.id}>
              <input
                type="radio"
                name="mediaId"
                value={asset.id}
                defaultChecked={mediaId === asset.id}
                disabled={!editable}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.publicUrl} alt={asset.altText} />
              <span>{asset.title}</span>
            </label>
          ))}
        </div>
      )}
      <Feedback state={state} />
      <SubmitButton>Mettre à jour</SubmitButton>
    </form>
  );
}

function EvidenceFields({
  sectionType,
  payload,
}: Readonly<{
  sectionType: string;
  payload: Readonly<Record<string, unknown>>;
}>) {
  const value = (key: string) =>
    typeof payload[key] === "string" ? (payload[key] as string) : "";
  return (
    <fieldset className="cms-evidence-fields">
      <legend>Gouvernance de la preuve</legend>
      <p className="section__note">
        Ces informations restent internes, sauf les champs de présentation. La
        page ne pourra pas être publiée tant que la preuve n’est pas approuvée
        et traçable.
      </p>
      <div className="admin-form-grid">
        <label>
          Statut
          <select
            name="evidenceStatus"
            defaultValue={value("evidenceStatus") || "Proposed"}
          >
            {[
              "Proposed",
              "Evidence pending",
              "Rights pending",
              "In review",
              "Approved",
              "Published",
              "Withdrawn",
            ].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          Classe de preuve
          <select
            name="evidenceClass"
            defaultValue={
              value("evidenceClass") ||
              (sectionType === "TESTIMONIAL" ? "Testimonial" : "Deliverable")
            }
          >
            {[
              "Deliverable",
              "Outcome",
              "Before/after",
              "Testimonial",
              "Process evidence",
              "Capability evidence",
            ].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="admin-form-grid">
        <label>
          Responsable de la preuve
          <input name="claimOwner" defaultValue={value("claimOwner")} />
        </label>
        <label>
          Date de vérification
          <input
            type="date"
            name="verificationDate"
            defaultValue={value("verificationDate")}
          />
        </label>
        <label>
          Emplacement de la source
          <input name="sourceLocation" defaultValue={value("sourceLocation")} />
        </label>
        <label>
          Responsable de la source
          <input name="sourceOwner" defaultValue={value("sourceOwner")} />
        </label>
      </div>
      <label>
        Autorisation d’attribution ou anonymisation
        <textarea
          name="attributionPermission"
          defaultValue={value("attributionPermission")}
        />
      </label>
      <div className="admin-form-grid">
        <label>
          Droits média
          <input name="mediaRights" defaultValue={value("mediaRights")} />
        </label>
        <label>
          Crédit média
          <input name="mediaCredit" defaultValue={value("mediaCredit")} />
        </label>
      </div>
      <label>
        Alternative accessible
        <textarea
          name="accessibleAlternative"
          defaultValue={value("accessibleAlternative")}
        />
      </label>
      <label>
        Service ou capacité lié
        <input name="relatedService" defaultValue={value("relatedService")} />
      </label>
      {sectionType === "CASE_STUDY" ? (
        <>
          <label>
            Contexte et défi vérifiés
            <textarea name="context" defaultValue={value("context")} />
          </label>
          <label>
            Périmètre approuvé et unités contributrices
            <textarea name="scope" defaultValue={value("scope")} />
          </label>
          <label>
            Preuve du travail ou du processus
            <textarea name="evidence" defaultValue={value("evidence")} />
          </label>
          <label>
            Résultat attribuable ou traitement qualitatif
            <textarea name="outcome" defaultValue={value("outcome")} />
          </label>
          <label>
            Niveau d’attribution du résultat
            <input
              name="outcomeTreatment"
              placeholder="Attribuable, qualitatif ou deliverable-only"
              defaultValue={value("outcomeTreatment")}
            />
          </label>
          <label>
            Limites et contexte de la revendication
            <textarea name="limitations" defaultValue={value("limitations")} />
          </label>
        </>
      ) : (
        <>
          <label>
            Témoignage exact approuvé
            <textarea name="quote" defaultValue={value("quote")} />
          </label>
          <label>
            Attribution publique approuvée
            <input name="attribution" defaultValue={value("attribution")} />
          </label>
        </>
      )}
    </fieldset>
  );
}

export function SectionJsonForm({
  sectionId,
  version,
  pageId,
  sectionType,
  order,
  payload,
  editable,
}: Readonly<{
  sectionId?: string;
  version?: number;
  pageId: string;
  sectionType?: string;
  order: number;
  payload: string;
  editable: boolean;
}>) {
  const [state, action] = useActionState(saveSectionAction, IDLE_ACTION_STATE);
  const isNew = !sectionId;
  return (
    <form
      action={action}
      className={
        isNew ? "admin-form-card cms-section-card cms-section-card--new" : ""
      }
    >
      {isNew ? <h3>Ajouter une section</h3> : null}
      {sectionId ? <input type="hidden" name="id" value={sectionId} /> : null}
      {sectionId ? (
        <input type="hidden" name="expectedVersion" value={version} />
      ) : null}
      <input type="hidden" name="pageId" value={pageId} />
      <div className="admin-form-grid">
        <label>
          Type
          <select name="sectionType" defaultValue={sectionType}>
            {SECTION_TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>
          Ordre
          <input type="number" name="order" min="0" defaultValue={order} />
        </label>
      </div>
      <label>
        Contenu JSON
        <textarea name="payload" rows={8} defaultValue={payload} />
      </label>
      <Feedback state={state} />
      <SubmitButton>{isNew ? "Ajouter" : "Mettre à jour le JSON"}</SubmitButton>
      {!isNew && !editable ? (
        <p className="admin-table__note">
          Cette page n&apos;est plus en brouillon.
        </p>
      ) : null}
    </form>
  );
}

export function PageTransitionForm({
  id,
  version,
  target,
  label,
}: Readonly<{ id: string; version: number; target: string; label: string }>) {
  const [state, action] = useActionState(
    transitionPageAction,
    IDLE_ACTION_STATE,
  );
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="expectedVersion" value={version} />
      <input type="hidden" name="target" value={target} />
      {target === "ARCHIVED" ? (
        <ConfirmAction consequence="La page sera retirée du site public et archivée.">
          {label}
        </ConfirmAction>
      ) : (
        <SubmitButton>{label}</SubmitButton>
      )}
      <Feedback state={state} />
    </form>
  );
}

export function UploadMediaForm({ worldKey }: Readonly<{ worldKey: string }>) {
  const [state, action] = useActionState(uploadMediaAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="admin-form-card cms-create-card">
      <h2>Ajouter un média</h2>
      <input type="hidden" name="worldKey" value={worldKey} />
      <label>
        Fichier
        <input
          type="file"
          name="file"
          accept="image/*,video/*,application/pdf"
          required
        />
      </label>
      <label>
        Titre
        <input name="title" />
      </label>
      <label>
        Texte alternatif
        <input name="altText" required />
      </label>
      <label>
        Tags
        <input name="tags" placeholder="équipe, campagne, print" />
      </label>
      <Feedback state={state} />
      <SubmitButton>Envoyer vers la médiathèque</SubmitButton>
      <p className="section__note">
        Une fois envoyée, l’image apparaît ci-contre et devient sélectionnable
        dans le champ « Image » de n’importe quelle section (Pages → Éditer →
        section HERO/MEDIA/CTA).
      </p>
    </form>
  );
}

export function DeleteMediaForm({ mediaId }: Readonly<{ mediaId: string }>) {
  const [state, action] = useActionState(deleteMediaAction, IDLE_ACTION_STATE);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={mediaId} />
      <ConfirmAction consequence="Le média sera supprimé définitivement s’il n’est plus utilisé.">
        Supprimer
      </ConfirmAction>
      <Feedback state={state} />
    </form>
  );
}
