"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
} from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import type {
  WorkspaceRevisionDto,
  WorkspaceSiteIdentityDto,
  WorkspacePageDto,
} from "@/modules/content/application/workspace-content-query";
import {
  clampColumnCount,
  createDefaultNestedBlock,
  getPageBlockDefinition,
  NESTABLE_BLOCK_TYPES,
  PAGE_BLOCK_REGISTRY,
  parseColumnsPayload,
  type NestableBlockType,
  type NestedBlock,
} from "@/modules/content/domain/page-block-registry";
import type { PageRevisionDiff } from "@/modules/content/domain/page-revision-diff";
import { sectionImageFormValue } from "@/modules/content/domain/section-image-settings";
import {
  defaultSiteIdentity,
  SITE_FONT_CHOICES,
  validateSiteIdentityConfig,
} from "@/modules/content/domain/site-identity";

import {
  Feedback,
  IDLE_ACTION_STATE,
  SubmitButton,
} from "../_components/feedback";
import { ConfirmAction } from "../_components/confirm-action";
import {
  createGlobalComponentAction,
  createPageAction,
  createPreviewShareAction,
  deleteGlobalComponentAction,
  deleteMediaAction,
  deletePageTemplateAction,
  deleteSectionAction,
  duplicatePageAction,
  saveSectionAction,
  saveSectionFieldsAction,
  saveSiteIdentityDraftAction,
  saveTemplateFromPageAction,
  restorePageRevisionAction,
  revokePreviewShareAction,
  schedulePageRevisionAction,
  startPageRevisionAction,
  startSiteIdentityDraftAction,
  transitionSiteIdentityAction,
  transitionPageRevisionAction,
  updateMediaDetailsAction,
  updatePageRevisionMetadataAction,
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

function useRefreshOnSuccess(status: string) {
  const router = useRouter();
  useEffect(() => {
    if (status === "success") router.refresh();
  }, [router, status]);
}

export function CreatePageForm({
  worldKey,
  templates = [],
}: Readonly<{
  worldKey: string;
  templates?: readonly Readonly<{ id: string; name: string; blockCount: number }>[];
}>) {
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
      {templates.length > 0 ? (
        <label>
          Gabarit de départ
          <select name="templateId" defaultValue="">
            <option value="">Page vide</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.blockCount} bloc
                {template.blockCount > 1 ? "s" : ""})
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <Feedback state={state} />
      <SubmitButton>Créer la page</SubmitButton>
      <p className="section__note">
        Le slug « accueil » pilote le hero du site public de l’univers.
      </p>
    </form>
  );
}

export function DuplicatePageForm({
  pageId,
  worldKey,
}: Readonly<{ pageId: string; worldKey: string }>) {
  const [state, action] = useActionState(duplicatePageAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="cms-builder__duplicate">
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="worldKey" value={worldKey} />
      <button type="submit" className="admin-table__action">
        Dupliquer
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function CreateGlobalComponentForm({
  worldKey,
}: Readonly<{ worldKey: string }>) {
  const [state, action] = useActionState(
    createGlobalComponentAction,
    IDLE_ACTION_STATE,
  );
  useRefreshOnSuccess(state.status);
  return (
    <form action={action} className="admin-form-card cms-create-card">
      <h2>Nouveau composant</h2>
      <input type="hidden" name="worldKey" value={worldKey} />
      <label>
        Nom
        <input name="name" required maxLength={80} placeholder="Bandeau CTA final" />
      </label>
      <label>
        Type de bloc
        <select name="sectionType" required defaultValue="">
          <option value="" disabled>
            Choisir…
          </option>
          {PAGE_BLOCK_REGISTRY.map((block) => (
            <option key={block.type} value={block.type}>
              {block.label}
            </option>
          ))}
        </select>
      </label>
      <Feedback state={state} />
      <SubmitButton>Créer le composant</SubmitButton>
      <p className="section__note">
        Son contenu se remplit ensuite dans la bibliothèque de composants, à
        l’aide de l’éditeur de page habituel.
      </p>
    </form>
  );
}

export function DeleteGlobalComponentForm({
  componentId,
  usageCount,
}: Readonly<{ componentId: string; usageCount: number }>) {
  const [state, action] = useActionState(
    deleteGlobalComponentAction,
    IDLE_ACTION_STATE,
  );
  useRefreshOnSuccess(state.status);
  return (
    <form action={action}>
      <input type="hidden" name="componentId" value={componentId} />
      {usageCount > 0 ? (
        <span
          className="admin-table__action"
          title="Détachez d’abord chaque page qui utilise ce composant."
        >
          Utilisé ({usageCount})
        </span>
      ) : (
        <ConfirmAction consequence="Ce composant global sera supprimé définitivement.">
          Supprimer
        </ConfirmAction>
      )}
      <Feedback state={state} />
    </form>
  );
}

export function SaveAsTemplateForm({
  pageId,
  worldKey,
  revisionId,
}: Readonly<{ pageId: string; worldKey: string; revisionId: string }>) {
  const [state, action] = useActionState(
    saveTemplateFromPageAction,
    IDLE_ACTION_STATE,
  );
  useRefreshOnSuccess(state.status);
  return (
    <form action={action} className="admin-form-card cms-create-card">
      <h2>Enregistrer comme gabarit</h2>
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="worldKey" value={worldKey} />
      <input type="hidden" name="revisionId" value={revisionId} />
      <label>
        Nom du gabarit
        <input name="name" required maxLength={80} placeholder="Page de service" />
      </label>
      <Feedback state={state} />
      <SubmitButton>Enregistrer</SubmitButton>
      <p className="section__note">
        Copie les blocs actuels de cette page dans un gabarit réutilisable
        pour créer de nouvelles pages.
      </p>
    </form>
  );
}

export function DeletePageTemplateForm({
  templateId,
}: Readonly<{ templateId: string }>) {
  const [state, action] = useActionState(
    deletePageTemplateAction,
    IDLE_ACTION_STATE,
  );
  useRefreshOnSuccess(state.status);
  return (
    <form action={action}>
      <input type="hidden" name="templateId" value={templateId} />
      <ConfirmAction consequence="Ce gabarit sera supprimé définitivement.">
        Supprimer
      </ConfirmAction>
      <Feedback state={state} />
    </form>
  );
}

export type PreviewShareDto = Readonly<{
  id: string;
  token: string;
  label: string | null;
  revisionId: string;
  expiresAt: Date;
}>;

export function RevisionEditor({
  pageId,
  draft,
  published,
  history,
  changeSummary,
  authors,
  images,
  publicPath,
  activeShares,
}: Readonly<{
  pageId: string;
  draft: WorkspaceRevisionDto | null;
  published: WorkspaceRevisionDto | null;
  history: readonly WorkspaceRevisionDto[];
  changeSummary: PageRevisionDiff | null;
  authors: Readonly<Record<string, string>>;
  images: readonly ImageOption[];
  publicPath: string;
  activeShares: readonly PreviewShareDto[];
}>) {
  const [startState, startAction] = useActionState(
    startPageRevisionAction,
    IDLE_ACTION_STATE,
  );
  useRefreshOnSuccess(startState.status);
  if (!draft) {
    return (
      <section className="admin-form-card">
        <h2>Version de travail</h2>
        <p className="admin-table__note">
          {published
            ? `La révision ${published.revisionNumber} est en ligne. Créez un brouillon isolé avant toute modification.`
            : "Cette page n’a pas encore de version de travail."}
        </p>
        <form action={startAction}>
          <input type="hidden" name="pageId" value={pageId} />
          <SubmitButton>Créer un brouillon</SubmitButton>
          <Feedback state={startState} />
        </form>
        <RevisionHistory
          pageId={pageId}
          revisions={history}
          restorable
          authors={authors}
        />
      </section>
    );
  }
  return (
    <>
      <ActiveRevisionEditor
        pageId={pageId}
        revision={draft}
        authors={authors}
        images={images}
        publicPath={publicPath}
      />
      <PreviewShareManager
        pageId={pageId}
        revisionId={draft.id}
        publicPath={publicPath}
        shares={activeShares}
      />
      {changeSummary ? <RevisionChangeSummary summary={changeSummary} /> : null}
      <RevisionHistory
        pageId={pageId}
        revisions={history}
        restorable={false}
        authors={authors}
      />
    </>
  );
}

function RevisionChangeSummary({
  summary,
}: Readonly<{ summary: PageRevisionDiff }>) {
  const groups = [
    ["Ajoutés", summary.added],
    ["Supprimés", summary.removed],
    ["Modifiés", summary.modified],
    ["Déplacés", summary.moved],
  ] as const;
  return (
    <section className="admin-form-card cms-revision-summary">
      <h3>Changements avant publication</h3>
      {summary.totalChanges === 0 ? (
        <p className="admin-table__note">
          Aucune différence avec la version publiée.
        </p>
      ) : (
        <>
          {groups.map(([label, values]) =>
            values.length ? (
              <div key={label}>
                <strong>
                  {label} · {values.length}
                </strong>
                <ul>
                  {values.map((value, index) => (
                    <li key={`${label}-${index}`}>{value}</li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
          {summary.fieldDiffs.length > 0 ? (
            <div className="cms-revision-summary__text-diffs">
              <strong>Détail des modifications de texte</strong>
              {summary.fieldDiffs.map((section) => (
                <div key={section.sectionKey} className="cms-text-diff">
                  <span className="cms-text-diff__section">
                    {section.label}
                  </span>
                  {section.fields.map((field) => (
                    <p key={field.key} className="cms-text-diff__field">
                      <span className="cms-text-diff__field-key">
                        {field.key}
                      </span>
                      {field.segments.map((segment, index) => (
                        <span
                          key={index}
                          className={
                            segment.type === "same"
                              ? undefined
                              : segment.type === "added"
                                ? "cms-text-diff__added"
                                : "cms-text-diff__removed"
                          }
                        >
                          {segment.text}
                        </span>
                      ))}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function RevisionHistory({
  pageId,
  revisions,
  restorable,
  authors,
}: Readonly<{
  pageId: string;
  revisions: readonly WorkspaceRevisionDto[];
  restorable: boolean;
  authors: Readonly<Record<string, string>>;
}>) {
  const candidates = revisions.filter((revision) =>
    ["PUBLISHED", "SUPERSEDED", "ARCHIVED"].includes(revision.status),
  );
  return (
    <details className="admin-user-card__details">
      <summary>Historique des révisions ({candidates.length})</summary>
      <ol className="cms-revision-history">
        {candidates.map((revision) => (
          <li key={revision.id}>
            <span>
              Version {revision.revisionNumber} · {revision.status}
            </span>
            <RevisionAttribution revision={revision} authors={authors} />
            {restorable ? (
              <RestoreRevisionForm pageId={pageId} revisionId={revision.id} />
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}

function RevisionAttribution({
  revision,
  authors,
}: Readonly<{
  revision: WorkspaceRevisionDto;
  authors: Readonly<Record<string, string>>;
}>) {
  const nameFor = (id: string | null) => (id ? (authors[id] ?? id) : null);
  const created = nameFor(revision.createdById);
  const reviewed = nameFor(revision.reviewedById);
  const published = nameFor(revision.publishedById);
  if (!created && !reviewed && !published) return null;
  return (
    <span className="cms-revision-attribution">
      {created ? <em>Créée par {created}</em> : null}
      {reviewed ? <em>Relue par {reviewed}</em> : null}
      {published ? <em>Publiée par {published}</em> : null}
    </span>
  );
}

function RestoreRevisionForm({
  pageId,
  revisionId,
}: Readonly<{ pageId: string; revisionId: string }>) {
  const [state, action] = useActionState(
    restorePageRevisionAction,
    IDLE_ACTION_STATE,
  );
  useRefreshOnSuccess(state.status);
  return (
    <form action={action}>
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="sourceRevisionId" value={revisionId} />
      <SubmitButton>Restaurer</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

export function SiteIdentityEditor({
  worldKey,
  identity,
  images,
  pages,
  focus = "all",
}: Readonly<{
  worldKey: string;
  identity: WorkspaceSiteIdentityDto | null;
  images: readonly ImageOption[];
  pages: readonly WorkspacePageDto[];
  focus?: "all" | "appearance" | "navigation" | "settings";
}>) {
  const [startState, startAction] = useActionState(
    startSiteIdentityDraftAction,
    IDLE_ACTION_STATE,
  );
  useRefreshOnSuccess(startState.status);
  const active = identity?.draftRevision ?? identity?.publishedRevision;
  const parsed = validateSiteIdentityConfig(
    (active?.config as Record<string, unknown> | null) ??
      defaultSiteIdentity(
        worldKey,
        worldKey === "kwaliti-print" ? "Kwaliti Print" : "Pixel&Digital",
      ),
  );
  const config = parsed.ok
    ? parsed.value
    : defaultSiteIdentity(
        worldKey,
        worldKey === "kwaliti-print" ? "Kwaliti Print" : "Pixel&Digital",
      );
  if (!identity?.draftRevision) {
    const heading =
      focus === "appearance"
        ? "Apparence publiée"
        : focus === "navigation"
          ? "Menus publiés"
          : focus === "settings"
            ? "Réglages publiés"
            : "Identité publiée";
    const actionLabel =
      focus === "appearance"
        ? "Modifier l’apparence"
        : focus === "navigation"
          ? "Modifier les menus"
          : focus === "settings"
            ? "Modifier les réglages"
            : "Modifier l’identité";
    return (
      <section className="admin-form-card cms-identity-editor">
        <h2>{heading}</h2>
        {focus === "navigation" ? (
          <div className="cms-published-menus">
            {config.menus.map((menu) => (
              <section key={menu.id}>
                <h3>{menu.name}</h3>
                <ul className="cms-published-navigation">
                  {menu.items.map((item) => (
                    <li key={`${item.label}-${item.href}`}>
                      <strong>{item.label}</strong>
                      <span>{item.href}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : focus === "settings" ? (
          <div className="cms-identity-summary">
            <div>
              <strong>{config.footerText}</strong>
              <span>
                {config.contactLabel} · {config.contactHref}
              </span>
              <span>{config.address}</span>
              {config.contactEmail ? <span>{config.contactEmail}</span> : null}
            </div>
          </div>
        ) : (
          <IdentitySummary config={config} images={images} />
        )}
        <form action={startAction}>
          <input type="hidden" name="worldKey" value={worldKey} />
          <SubmitButton>{actionLabel}</SubmitButton>
          <Feedback state={startState} />
        </form>
      </section>
    );
  }
  return (
    <ActiveSiteIdentityEditor
      worldKey={worldKey}
      revision={identity.draftRevision}
      config={config}
      images={images}
      pages={pages}
      focus={focus}
    />
  );
}

function ActiveSiteIdentityEditor({
  worldKey,
  revision,
  config,
  images,
  pages,
  focus,
}: Readonly<{
  worldKey: string;
  revision: NonNullable<WorkspaceSiteIdentityDto["draftRevision"]>;
  config: ReturnType<typeof defaultSiteIdentity>;
  images: readonly ImageOption[];
  pages: readonly WorkspacePageDto[];
  focus: "all" | "appearance" | "navigation" | "settings";
}>) {
  const [state, action] = useActionState(
    saveSiteIdentityDraftAction,
    IDLE_ACTION_STATE,
  );
  useRefreshOnSuccess(state.status);
  const editable = revision.status === "DRAFT";
  const navigationText = config.navigationItems
    .map((item) => `${item.label} | ${item.href}`)
    .join("\n");
  const showAppearance = focus === "all" || focus === "appearance";
  const showNavigation = focus === "all" || focus === "navigation";
  const showSettings = focus === "all" || focus === "settings";
  const heading =
    focus === "appearance"
      ? "Apparence"
      : focus === "navigation"
        ? "Menus"
        : focus === "settings"
          ? "Réglages du site"
          : "Identité du site";
  return (
    <section className="admin-form-card cms-identity-editor">
      <h2>
        {heading} · version {revision.revisionNumber} · {revision.status}
      </h2>
      {editable ? (
        <form action={action}>
          <input type="hidden" name="worldKey" value={worldKey} />
          <input type="hidden" name="revisionId" value={revision.id} />
          <input
            type="hidden"
            name="expectedVersion"
            value={revision.version}
          />
          {showAppearance ? (
            <>
              <div className="admin-form-grid">
                <label>
                  Nom du site
                  <input
                    name="siteName"
                    defaultValue={config.siteName}
                    required
                  />
                </label>
                <label>
                  Baseline
                  <input
                    name="tagline"
                    defaultValue={config.tagline}
                    maxLength={180}
                  />
                </label>
                <label>
                  Police des titres
                  <select name="headingFont" defaultValue={config.headingFont}>
                    {SITE_FONT_CHOICES.map((font) => (
                      <option key={font}>{font}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Police des textes
                  <select name="bodyFont" defaultValue={config.bodyFont}>
                    {SITE_FONT_CHOICES.map((font) => (
                      <option key={font}>{font}</option>
                    ))}
                  </select>
                </label>
              </div>
              <IdentityMediaPicker
                name="logoMediaId"
                label="Logo"
                selectedId={config.logoMediaId}
                images={images}
              />
              <IdentityMediaPicker
                name="faviconMediaId"
                label="Favicon"
                selectedId={config.faviconMediaId}
                images={images}
              />
              <IdentityMediaPicker
                name="invoiceStampMediaId"
                label="Cachet / image complémentaire (factures imprimées, facultatif)"
                selectedId={config.invoiceStampMediaId}
                images={images}
              />
            </>
          ) : (
            <>
              <input type="hidden" name="siteName" value={config.siteName} />
              <input type="hidden" name="tagline" value={config.tagline} />
              <input
                type="hidden"
                name="headingFont"
                value={config.headingFont}
              />
              <input type="hidden" name="bodyFont" value={config.bodyFont} />
              <input
                type="hidden"
                name="logoMediaId"
                value={config.logoMediaId}
              />
              <input
                type="hidden"
                name="faviconMediaId"
                value={config.faviconMediaId}
              />
              <input
                type="hidden"
                name="invoiceStampMediaId"
                value={config.invoiceStampMediaId}
              />
            </>
          )}
          {showNavigation ? (
            <MenuBuilder
              initialMenus={config.menus}
              initialPrimaryMenuId={config.primaryMenuId}
              initialFooterMenuId={config.footerMenuId}
              pages={pages}
              worldKey={worldKey}
            />
          ) : (
            <>
              <input
                type="hidden"
                name="navigationItems"
                value={navigationText}
              />
              <input
                type="hidden"
                name="menusJson"
                value={JSON.stringify(config.menus)}
              />
              <input
                type="hidden"
                name="primaryMenuId"
                value={config.primaryMenuId}
              />
              <input
                type="hidden"
                name="footerMenuId"
                value={config.footerMenuId}
              />
            </>
          )}
          {showSettings ? (
            <>
              <div className="cms-settings-section">
                <h3>Informations publiques</h3>
                <div className="admin-form-grid">
                  <label>
                    E-mail de contact
                    <input
                      type="email"
                      name="contactEmail"
                      defaultValue={config.contactEmail}
                    />
                  </label>
                  <label>
                    Téléphone
                    <input
                      type="tel"
                      name="contactPhone"
                      defaultValue={config.contactPhone}
                    />
                  </label>
                  <label>
                    Numéro WhatsApp
                    <input
                      type="tel"
                      name="whatsappNumber"
                      defaultValue={config.whatsappNumber}
                      placeholder="+226 70 00 00 00"
                      aria-describedby="whatsapp-help"
                    />
                    <span id="whatsapp-help" className="admin-field-help">
                      Affiche un accès WhatsApp sur le site après publication.
                    </span>
                  </label>
                </div>
                <label>
                  Adresse ou zone desservie
                  <input
                    name="address"
                    defaultValue={config.address}
                    maxLength={220}
                  />
                </label>
              </div>
              <div className="cms-settings-section">
                <h3>Référencement</h3>
                <CharCounterField
                  label="Description SEO par défaut"
                  name="defaultSeoDescription"
                  defaultValue={config.defaultSeoDescription}
                  maxLength={180}
                  multiline
                />
              </div>
              <div className="cms-settings-section">
                <h3>Appel à l’action principal</h3>
                <div className="admin-form-grid">
                  <label>
                    Libellé du contact
                    <input
                      name="contactLabel"
                      defaultValue={config.contactLabel}
                      required
                    />
                  </label>
                  <label>
                    Lien du contact
                    <input
                      name="contactHref"
                      defaultValue={config.contactHref}
                      required
                    />
                  </label>
                </div>
              </div>
              <div className="cms-settings-section cms-settings-section--wide">
                <h3>Pied de page</h3>
                <label>
                  Texte principal du footer
                  <textarea
                    name="footerText"
                    rows={4}
                    defaultValue={config.footerText}
                    maxLength={500}
                  />
                </label>
              </div>
              <div className="cms-settings-section">
                <h3>Réseaux et obligations</h3>
                <div className="admin-form-grid">
                  <label>
                    LinkedIn
                    <input
                      type="url"
                      name="linkedinHref"
                      defaultValue={config.linkedinHref}
                    />
                  </label>
                  <label>
                    Instagram
                    <input
                      type="url"
                      name="instagramHref"
                      defaultValue={config.instagramHref}
                    />
                  </label>
                  <label>
                    Mentions légales
                    <input
                      name="legalNoticeHref"
                      defaultValue={config.legalNoticeHref}
                      placeholder="/mentions-legales"
                    />
                  </label>
                  <label>
                    Politique de confidentialité
                    <input
                      name="privacyPolicyHref"
                      defaultValue={config.privacyPolicyHref}
                      placeholder="/confidentialite"
                    />
                  </label>
                </div>
              </div>
            </>
          ) : (
            <>
              <input
                type="hidden"
                name="footerText"
                value={config.footerText}
              />
              <input
                type="hidden"
                name="contactLabel"
                value={config.contactLabel}
              />
              <input
                type="hidden"
                name="contactHref"
                value={config.contactHref}
              />
              <input
                type="hidden"
                name="defaultSeoDescription"
                value={config.defaultSeoDescription}
              />
              <input
                type="hidden"
                name="contactEmail"
                value={config.contactEmail}
              />
              <input
                type="hidden"
                name="contactPhone"
                value={config.contactPhone}
              />
              <input
                type="hidden"
                name="whatsappNumber"
                value={config.whatsappNumber}
              />
              <input type="hidden" name="address" value={config.address} />
              <input
                type="hidden"
                name="linkedinHref"
                value={config.linkedinHref}
              />
              <input
                type="hidden"
                name="instagramHref"
                value={config.instagramHref}
              />
              <input
                type="hidden"
                name="legalNoticeHref"
                value={config.legalNoticeHref}
              />
              <input
                type="hidden"
                name="privacyPolicyHref"
                value={config.privacyPolicyHref}
              />
            </>
          )}
          <SubmitButton>{`Enregistrer ${heading.toLowerCase()}`}</SubmitButton>
          <Feedback state={state} />
        </form>
      ) : (
        <IdentitySummary config={config} images={images} />
      )}
      <SiteIdentityWorkflow worldKey={worldKey} revision={revision} />
    </section>
  );
}

type EditableMenu = {
  id: string;
  name: string;
  items: { label: string; href: string }[];
};

function MenuBuilder({
  initialMenus,
  initialPrimaryMenuId,
  initialFooterMenuId,
  pages,
  worldKey,
}: Readonly<{
  initialMenus: readonly Readonly<{
    id: string;
    name: string;
    items: readonly Readonly<{ label: string; href: string }>[];
  }>[];
  initialPrimaryMenuId: string;
  initialFooterMenuId: string;
  pages: readonly WorkspacePageDto[];
  worldKey: string;
}>) {
  const [menus, setMenus] = useState<EditableMenu[]>(() =>
    initialMenus.map((menu) => ({
      id: menu.id,
      name: menu.name,
      items: menu.items.map((item) => ({ ...item })),
    })),
  );
  const [activeMenuId, setActiveMenuId] = useState(
    initialMenus[0]?.id ?? "main",
  );
  const [primaryMenuId, setPrimaryMenuId] = useState(initialPrimaryMenuId);
  const [footerMenuId, setFooterMenuId] = useState(initialFooterMenuId);
  const [selectedPageId, setSelectedPageId] = useState(pages[0]?.id ?? "");
  const [customLabel, setCustomLabel] = useState("");
  const [customHref, setCustomHref] = useState("");
  const [newMenuName, setNewMenuName] = useState("");
  const activeMenu = menus.find((menu) => menu.id === activeMenuId) ?? menus[0];
  const primaryItems =
    menus.find((menu) => menu.id === primaryMenuId)?.items ?? [];

  function updateActive(update: (menu: EditableMenu) => EditableMenu) {
    if (!activeMenu) return;
    setMenus((current) =>
      current.map((menu) => (menu.id === activeMenu.id ? update(menu) : menu)),
    );
  }

  function addItem(item: { label: string; href: string }) {
    if (!activeMenu || !item.label.trim() || !item.href.trim()) return;
    updateActive((menu) => ({
      ...menu,
      items: [
        ...menu.items,
        { label: item.label.trim(), href: item.href.trim() },
      ],
    }));
  }

  function addSelectedPage() {
    const page = pages.find((candidate) => candidate.id === selectedPageId);
    if (!page) return;
    const href =
      page.routePath ??
      (page.slug === "accueil"
        ? worldKey === "kwaliti-print"
          ? "/kwaliti-print"
          : "/"
        : worldKey === "kwaliti-print"
          ? `/kwaliti-print/${page.slug}`
          : `/${page.slug}`);
    addItem({ label: page.title, href });
  }

  function addMenu() {
    const name = newMenuName.trim();
    if (!name || menus.length >= 8) return;
    const base =
      name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "menu";
    let id = base;
    let suffix = 2;
    while (menus.some((menu) => menu.id === id)) id = `${base}-${suffix++}`;
    setMenus((current) => [...current, { id, name, items: [] }]);
    setActiveMenuId(id);
    setNewMenuName("");
  }

  function removeMenu() {
    if (!activeMenu || menus.length === 1) return;
    if (!window.confirm(`Supprimer le menu « ${activeMenu.name} » ?`)) return;
    const remaining = menus.filter((menu) => menu.id !== activeMenu.id);
    const fallback = remaining[0]?.id ?? "main";
    setMenus(remaining);
    setActiveMenuId(fallback);
    if (primaryMenuId === activeMenu.id) setPrimaryMenuId(fallback);
    if (footerMenuId === activeMenu.id) setFooterMenuId(fallback);
  }

  return (
    <section className="cms-menu-builder" aria-label="Constructeur de menus">
      <input type="hidden" name="menusJson" value={JSON.stringify(menus)} />
      <input type="hidden" name="primaryMenuId" value={primaryMenuId} />
      <input type="hidden" name="footerMenuId" value={footerMenuId} />
      <input
        type="hidden"
        name="navigationItems"
        value={primaryItems
          .map((item) => `${item.label} | ${item.href}`)
          .join("\n")}
      />

      <div className="cms-menu-builder__head">
        <div>
          <span>Structure du site</span>
          <h3>Menus</h3>
          <p>
            Créez plusieurs menus, puis affectez-les à l’en-tête ou au pied de
            page.
          </p>
        </div>
        <div className="cms-menu-builder__new">
          <input
            aria-label="Nom du nouveau menu"
            value={newMenuName}
            onChange={(event) => setNewMenuName(event.target.value)}
            placeholder="Ex. Services"
            maxLength={80}
          />
          <button type="button" onClick={addMenu}>
            Créer un menu
          </button>
        </div>
      </div>

      <div
        className="cms-menu-builder__tabs"
        role="tablist"
        aria-label="Menus disponibles"
      >
        {menus.map((menu) => (
          <button
            type="button"
            role="tab"
            aria-selected={menu.id === activeMenu?.id}
            className={menu.id === activeMenu?.id ? "is-active" : ""}
            key={menu.id}
            onClick={() => setActiveMenuId(menu.id)}
          >
            {menu.name} <span>{menu.items.length}</span>
          </button>
        ))}
      </div>

      {activeMenu ? (
        <div className="cms-menu-builder__workspace">
          <aside className="cms-menu-builder__sources">
            <section>
              <h4>Ajouter une page</h4>
              {pages.length ? (
                <>
                  <select
                    value={selectedPageId}
                    onChange={(event) => setSelectedPageId(event.target.value)}
                  >
                    {pages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.title} · {page.routePath ?? `/${page.slug}`}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={addSelectedPage}>
                    Ajouter au menu
                  </button>
                </>
              ) : (
                <p className="admin-empty">Aucune page disponible.</p>
              )}
            </section>
            <section>
              <h4>Ajouter un lien personnalisé</h4>
              <input
                aria-label="Libellé du lien personnalisé"
                value={customLabel}
                onChange={(event) => setCustomLabel(event.target.value)}
                placeholder="Libellé"
              />
              <input
                aria-label="Adresse du lien personnalisé"
                value={customHref}
                onChange={(event) => setCustomHref(event.target.value)}
                placeholder="/adresse ou https://…"
              />
              <button
                type="button"
                onClick={() => {
                  addItem({ label: customLabel, href: customHref });
                  setCustomLabel("");
                  setCustomHref("");
                }}
              >
                Ajouter le lien
              </button>
            </section>
          </aside>

          <div className="cms-menu-builder__structure">
            <div className="cms-menu-builder__menu-title">
              <label>
                Nom du menu
                <input
                  value={activeMenu.name}
                  maxLength={80}
                  onChange={(event) =>
                    updateActive((menu) => ({
                      ...menu,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <button
                type="button"
                onClick={removeMenu}
                disabled={menus.length === 1}
              >
                Supprimer ce menu
              </button>
            </div>
            {activeMenu.items.length === 0 ? (
              <p className="admin-empty">
                Ce menu est vide. Ajoutez une page ou un lien depuis la colonne
                de gauche.
              </p>
            ) : (
              <ol className="cms-menu-builder__items">
                {activeMenu.items.map((item, index) => (
                  <li
                    key={`${index}-${item.href}`}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        "text/x-menu-item",
                        String(index),
                      );
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(event) => {
                      if (
                        event.dataTransfer.types.includes("text/x-menu-item")
                      ) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }
                    }}
                    onDrop={(event) => {
                      const from = Number(
                        event.dataTransfer.getData("text/x-menu-item"),
                      );
                      if (!Number.isInteger(from)) return;
                      event.preventDefault();
                      updateActive((menu) => ({
                        ...menu,
                        items: moveItem(menu.items, from, index),
                      }));
                    }}
                  >
                    <span className="cms-menu-builder__grip" aria-hidden="true">
                      ⋮⋮
                    </span>
                    <div>
                      <input
                        aria-label={`Libellé du lien ${index + 1}`}
                        value={item.label}
                        onChange={(event) =>
                          updateActive((menu) => ({
                            ...menu,
                            items: menu.items.map(
                              (candidate, candidateIndex) =>
                                candidateIndex === index
                                  ? { ...candidate, label: event.target.value }
                                  : candidate,
                            ),
                          }))
                        }
                      />
                      <input
                        aria-label={`Adresse du lien ${index + 1}`}
                        value={item.href}
                        onChange={(event) =>
                          updateActive((menu) => ({
                            ...menu,
                            items: menu.items.map(
                              (candidate, candidateIndex) =>
                                candidateIndex === index
                                  ? { ...candidate, href: event.target.value }
                                  : candidate,
                            ),
                          }))
                        }
                      />
                    </div>
                    <div className="cms-menu-builder__item-actions">
                      <button
                        type="button"
                        aria-label={`Monter ${item.label}`}
                        disabled={index === 0}
                        onClick={() =>
                          updateActive((menu) => ({
                            ...menu,
                            items: moveItem(menu.items, index, index - 1),
                          }))
                        }
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Descendre ${item.label}`}
                        disabled={index === activeMenu.items.length - 1}
                        onClick={() =>
                          updateActive((menu) => ({
                            ...menu,
                            items: moveItem(menu.items, index, index + 1),
                          }))
                        }
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        aria-label={`Retirer ${item.label}`}
                        onClick={() =>
                          updateActive((menu) => ({
                            ...menu,
                            items: menu.items.filter(
                              (_, candidateIndex) => candidateIndex !== index,
                            ),
                          }))
                        }
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      ) : null}

      <div className="cms-menu-builder__assignments">
        <label>
          Menu de l’en-tête
          <select
            value={primaryMenuId}
            onChange={(event) => setPrimaryMenuId(event.target.value)}
          >
            {menus.map((menu) => (
              <option key={menu.id} value={menu.id}>
                {menu.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Menu du pied de page
          <select
            value={footerMenuId}
            onChange={(event) => setFooterMenuId(event.target.value)}
          >
            {menus.map((menu) => (
              <option key={menu.id} value={menu.id}>
                {menu.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}

function IdentityMediaPicker({
  name,
  label,
  selectedId,
  images,
  disabled = false,
}: Readonly<{
  name: string;
  label: string;
  selectedId: string;
  images: readonly ImageOption[];
  disabled?: boolean;
}>) {
  return (
    <fieldset className="cms-identity-media">
      <legend>{label}</legend>
      <div className="cms-image-picker" role="radiogroup">
        <label className="cms-image-picker__tile cms-image-picker__tile--empty">
          <input
            type="radio"
            name={name}
            value=""
            defaultChecked={!selectedId}
            disabled={disabled}
          />
          <span>Aucun</span>
        </label>
        {images.map((image) => (
          <label className="cms-image-picker__tile" key={image.id}>
            <input
              type="radio"
              name={name}
              value={image.id}
              defaultChecked={selectedId === image.id}
              disabled={disabled}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.publicUrl} alt={image.altText} />
            <span>{image.title}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function IdentitySummary({
  config,
  images,
}: Readonly<{
  config: ReturnType<typeof defaultSiteIdentity>;
  images: readonly ImageOption[];
}>) {
  const logo = images.find((image) => image.id === config.logoMediaId);
  return (
    <div className="cms-identity-summary">
      {logo ? (
        <Image
          src={logo.publicUrl}
          alt={logo.altText}
          width={112}
          height={56}
        />
      ) : (
        <strong>{config.siteName}</strong>
      )}
      <div>
        <strong>{config.siteName}</strong>
        <span>{config.tagline}</span>
      </div>
      <span>
        {config.headingFont} / {config.bodyFont}
      </span>
    </div>
  );
}

function SiteIdentityWorkflow({
  worldKey,
  revision,
}: Readonly<{
  worldKey: string;
  revision: NonNullable<WorkspaceSiteIdentityDto["draftRevision"]>;
}>) {
  const transitions =
    revision.status === "DRAFT"
      ? [["IN_REVIEW", "Soumettre en revue"]]
      : revision.status === "IN_REVIEW"
        ? [
            ["APPROVED", "Approuver"],
            ["DRAFT", "Demander des corrections"],
          ]
        : revision.status === "APPROVED"
          ? [
              ["PUBLISHED", "Publier l’identité"],
              ["DRAFT", "Renvoyer en brouillon"],
            ]
          : [];
  return (
    <div className="cms-workflow">
      {transitions.map(([target, label]) => (
        <SiteIdentityTransition
          key={target}
          worldKey={worldKey}
          revision={revision}
          target={target}
          label={label}
        />
      ))}
    </div>
  );
}

function SiteIdentityTransition({
  worldKey,
  revision,
  target,
  label,
}: Readonly<{
  worldKey: string;
  revision: NonNullable<WorkspaceSiteIdentityDto["draftRevision"]>;
  target: string;
  label: string;
}>) {
  const [state, action] = useActionState(
    transitionSiteIdentityAction,
    IDLE_ACTION_STATE,
  );
  useRefreshOnSuccess(state.status);
  return (
    <form action={action}>
      <input type="hidden" name="worldKey" value={worldKey} />
      <input type="hidden" name="revisionId" value={revision.id} />
      <input type="hidden" name="expectedVersion" value={revision.version} />
      <input type="hidden" name="target" value={target} />
      <SubmitButton>{label}</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

function PreviewShareManager({
  pageId,
  revisionId,
  publicPath,
  shares,
}: Readonly<{
  pageId: string;
  revisionId: string;
  publicPath: string;
  shares: readonly PreviewShareDto[];
}>) {
  const [createState, createAction] = useActionState(
    createPreviewShareAction,
    IDLE_ACTION_STATE,
  );
  useRefreshOnSuccess(createState.status);
  return (
    <details className="admin-user-card__details cms-preview-shares">
      <summary>Liens d’aperçu partageables ({shares.length})</summary>
      {shares.length > 0 ? (
        <ul className="cms-preview-shares__list">
          {shares.map((share) => (
            <PreviewShareRow
              key={share.id}
              share={share}
              publicPath={publicPath}
            />
          ))}
        </ul>
      ) : (
        <p className="admin-empty">Aucun lien de partage actif.</p>
      )}
      <form action={createAction} className="cms-preview-shares__create">
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="revisionId" value={revisionId} />
        <label>
          Description (facultatif)
          <input name="label" maxLength={80} placeholder="Pour le client X" />
        </label>
        <label>
          Expire dans
          <select name="expiresInDays" defaultValue="7">
            <option value="1">1 jour</option>
            <option value="7">7 jours</option>
            <option value="30">30 jours</option>
            <option value="90">90 jours</option>
          </select>
        </label>
        <SubmitButton>Créer un lien de partage</SubmitButton>
        <Feedback state={createState} />
      </form>
      <p className="admin-field-help">
        Le lien montre exactement cette version, même après une modification
        ultérieure, sans nécessiter de compte Workspace.
      </p>
    </details>
  );
}

function PreviewShareRow({
  share,
  publicPath,
}: Readonly<{ share: PreviewShareDto; publicPath: string }>) {
  const [revokeState, revokeAction] = useActionState(
    revokePreviewShareAction,
    IDLE_ACTION_STATE,
  );
  useRefreshOnSuccess(revokeState.status);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}${publicPath}?share=${share.token}`;
  return (
    <li className="cms-preview-shares__item">
      <div>
        <strong>{share.label || "Lien de partage"}</strong>
        <span>
          Expire le {share.expiresAt.toLocaleDateString("fr-FR")}
        </span>
      </div>
      <input
        readOnly
        value={url}
        aria-label="URL du lien de partage"
        onFocus={(event) => event.currentTarget.select()}
      />
      <form action={revokeAction}>
        <input type="hidden" name="id" value={share.id} />
        <SubmitButton>Révoquer</SubmitButton>
      </form>
      <Feedback state={revokeState} />
    </li>
  );
}

function ActiveRevisionEditor({
  pageId,
  revision,
  authors,
  images,
  publicPath,
}: Readonly<{
  pageId: string;
  revision: WorkspaceRevisionDto;
  authors: Readonly<Record<string, string>>;
  images: readonly ImageOption[];
  publicPath: string;
}>) {
  const [saveState, saveAction] = useActionState(
    updatePageRevisionMetadataAction,
    IDLE_ACTION_STATE,
  );
  useRefreshOnSuccess(saveState.status);
  const [previewTitle, setPreviewTitle] = useState(
    revision.seoTitle || revision.title,
  );
  const [previewDescription, setPreviewDescription] = useState(
    revision.seoDescription ?? "",
  );
  const transitions =
    revision.status === "DRAFT"
      ? [["IN_REVIEW", "Soumettre en revue"]]
      : revision.status === "IN_REVIEW"
        ? [
            ["APPROVED", "Approuver"],
            ["DRAFT", "Demander des corrections"],
          ]
        : revision.status === "APPROVED"
          ? [
              ["PUBLISHED", "Publier"],
              ["DRAFT", "Renvoyer en brouillon"],
            ]
          : [];
  return (
    <section className="admin-form-card">
      <h2>
        Version de travail {revision.revisionNumber} · {revision.status}
      </h2>
      <RevisionAttribution revision={revision} authors={authors} />
      <form action={saveAction}>
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="revisionId" value={revision.id} />
        <input type="hidden" name="expectedVersion" value={revision.version} />
        <label>
          Titre
          <input
            name="title"
            defaultValue={revision.title}
            required
            disabled={revision.status !== "DRAFT"}
          />
        </label>
        <div className="admin-form-grid">
          <CharCounterField
            label="Titre SEO"
            name="seoTitle"
            defaultValue={revision.seoTitle ?? ""}
            maxLength={70}
            disabled={revision.status !== "DRAFT"}
            onValueChange={(value) => setPreviewTitle(value || revision.title)}
          />
          <CharCounterField
            label="Description SEO"
            name="seoDescription"
            defaultValue={revision.seoDescription ?? ""}
            maxLength={180}
            multiline
            disabled={revision.status !== "DRAFT"}
            onValueChange={setPreviewDescription}
          />
        </div>
        <SerpPreview
          title={previewTitle}
          description={previewDescription}
          path={publicPath}
        />
        <IdentityMediaPicker
          name="ogImageMediaId"
          label="Image de partage (Open Graph, réseaux sociaux)"
          selectedId={revision.ogImageMediaId ?? ""}
          images={images}
          disabled={revision.status !== "DRAFT"}
        />
        {revision.status === "DRAFT" ? (
          <SubmitButton>Enregistrer la version</SubmitButton>
        ) : null}
        <Feedback state={saveState} />
      </form>
      {revision.status === "APPROVED" ? (
        <ScheduledPublishForm pageId={pageId} revision={revision} />
      ) : null}
      <div className="cms-workflow">
        {transitions.map(([target, label]) => (
          <RevisionTransitionForm
            key={target}
            pageId={pageId}
            revision={revision}
            target={target}
            label={label}
          />
        ))}
      </div>
    </section>
  );
}

function ScheduledPublishForm({
  pageId,
  revision,
}: Readonly<{ pageId: string; revision: WorkspaceRevisionDto }>) {
  const [state, action] = useActionState(
    schedulePageRevisionAction,
    IDLE_ACTION_STATE,
  );
  useRefreshOnSuccess(state.status);
  const defaultValue = revision.scheduledPublishAt
    ? new Date(
        revision.scheduledPublishAt.getTime() -
          revision.scheduledPublishAt.getTimezoneOffset() * 60_000,
      )
        .toISOString()
        .slice(0, 16)
    : "";
  return (
    <form action={action} className="cms-scheduled-publish">
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="revisionId" value={revision.id} />
      <input type="hidden" name="expectedVersion" value={revision.version} />
      <label>
        Publication programmée
        <input
          type="datetime-local"
          name="scheduledPublishAt"
          defaultValue={defaultValue}
        />
      </label>
      {revision.scheduledPublishAt ? (
        <p className="admin-table__note">
          Publication automatique prévue le{" "}
          {revision.scheduledPublishAt.toLocaleString("fr-FR")}.
        </p>
      ) : null}
      <SubmitButton>
        {revision.scheduledPublishAt ? "Modifier la programmation" : "Programmer"}
      </SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

function RevisionTransitionForm({
  pageId,
  revision,
  target,
  label,
}: Readonly<{
  pageId: string;
  revision: WorkspaceRevisionDto;
  target: string;
  label: string;
}>) {
  const [state, action] = useActionState(
    transitionPageRevisionAction,
    IDLE_ACTION_STATE,
  );
  useRefreshOnSuccess(state.status);
  return (
    <form action={action}>
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="revisionId" value={revision.id} />
      <input type="hidden" name="expectedVersion" value={revision.version} />
      <input type="hidden" name="target" value={target} />
      <SubmitButton>{label}</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}

export function DeleteSectionForm({
  sectionId,
  pageId,
  revisionId,
}: Readonly<{ sectionId: string; pageId: string; revisionId: string }>) {
  const [state, action] = useActionState(
    deleteSectionAction,
    IDLE_ACTION_STATE,
  );
  useRefreshOnSuccess(state.status);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={sectionId} />
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="revisionId" value={revisionId} />
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
  revisionId,
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
  revisionId: string;
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
  useRefreshOnSuccess(state.status);
  const formRef = useRef<HTMLFormElement>(null);
  const isDirtyRef = useRef(false);
  function markDirty() {
    isDirtyRef.current = true;
  }
  function autosaveOnBlur(event: FocusEvent<HTMLFormElement>) {
    if (!isDirtyRef.current) return;
    const next = event.relatedTarget;
    if (next instanceof HTMLElement && next.getAttribute("type") === "submit") {
      return;
    }
    isDirtyRef.current = false;
    formRef.current?.requestSubmit();
  }
  function autosaveOnChange(event: ChangeEvent<HTMLFormElement>) {
    markDirty();
    const target = event.target;
    const isDiscreteControl =
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLInputElement &&
        (target.type === "checkbox" || target.type === "radio"));
    if (isDiscreteControl) {
      isDirtyRef.current = false;
      formRef.current?.requestSubmit();
    }
  }
  const definition = getPageBlockDefinition(sectionType);
  const hasPrimaryMedia = definition?.fields.some(
    (field) => field.kind === "MEDIA",
  );
  const hasItems = definition?.fields.some((field) => field.key === "items");
  const hasMultipleMedia = definition?.fields.some(
    (field) => field.key === "mediaIds",
  );
  const selectedMediaIds = Array.isArray(evidencePayload.mediaIds)
    ? evidencePayload.mediaIds.filter(
        (id): id is string => typeof id === "string",
      )
    : [];
  const [itemRows, setItemRows] = useState<
    readonly { key: string; title: string; text: string }[]
  >(() =>
    Array.isArray(evidencePayload.items)
      ? evidencePayload.items.flatMap((item, index) => {
          if (!item || typeof item !== "object") return [];
          const record = item as Record<string, unknown>;
          return [
            {
              key: `initial_${index}`,
              title: String(record.title ?? ""),
              text: String(record.text ?? ""),
            },
          ];
        })
      : [],
  );
  const nextItemKeyRef = useRef(0);
  // Structural changes (add/remove/reorder) submit immediately, but they
  // can't just call requestSubmit() and hope the DOM has already picked up
  // the new row order by the time the browser serializes the form -- that
  // race loses edits. Instead, read the *current* (possibly still-unsaved)
  // title/text values straight out of the DOM, apply the structural change
  // to that array directly, and submit it -- independent of when React
  // actually re-renders the reordered rows.
  function currentItemPairs(): { title: string; text: string }[] {
    const form = formRef.current;
    if (!form) return [];
    const data = new FormData(form);
    const titles = data.getAll("itemTitle").map(String);
    const texts = data.getAll("itemText").map(String);
    const length = Math.max(titles.length, texts.length);
    return Array.from({ length }, (_, i) => ({
      title: titles[i] ?? "",
      text: texts[i] ?? "",
    }));
  }
  function submitItemPairs(pairs: readonly { title: string; text: string }[]) {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    data.delete("itemTitle");
    data.delete("itemText");
    for (const pair of pairs) {
      data.append("itemTitle", pair.title);
      data.append("itemText", pair.text);
    }
    isDirtyRef.current = false;
    startTransition(() => action(data));
  }
  function addItemRow() {
    const pairs = [...currentItemPairs(), { title: "", text: "" }];
    setItemRows((rows) => [
      ...rows,
      { key: `new_${nextItemKeyRef.current++}`, title: "", text: "" },
    ]);
    submitItemPairs(pairs);
  }
  function removeItemRow(key: string) {
    const index = itemRows.findIndex((row) => row.key === key);
    const pairs = currentItemPairs();
    if (index >= 0) pairs.splice(index, 1);
    setItemRows((rows) => rows.filter((row) => row.key !== key));
    submitItemPairs(pairs);
  }
  function moveItemRow(key: string, offset: number) {
    const index = itemRows.findIndex((row) => row.key === key);
    const target = index + offset;
    const pairs = currentItemPairs();
    if (index < 0 || target < 0 || target >= pairs.length) return;
    const [pair] = pairs.splice(index, 1);
    if (pair) pairs.splice(target, 0, pair);
    setItemRows((rows) => {
      const next = [...rows];
      const [row] = next.splice(index, 1);
      if (row) next.splice(target, 0, row);
      return next;
    });
    submitItemPairs(pairs);
  }
  const nestedKeyRef = useRef(0);
  const [columnsState, setColumnsState] = useState<{
    columnCount: number;
    columns: NestedBlock[][];
  }>(() => {
    const parsed = parseColumnsPayload(
      JSON.stringify({
        columnCount: evidencePayload.columnCount,
        columns: evidencePayload.columns,
      }),
    );
    return {
      columnCount: parsed.columnCount,
      columns: parsed.columns.map((column) => [...column]),
    };
  });
  // Structural nested-block changes (add/remove/move/column count) submit
  // immediately with an explicitly-built payload, same reasoning as the
  // items repeater: requestSubmit() reading the DOM can't be trusted to
  // race-win against React's own re-render.
  function submitColumns(next: { columnCount: number; columns: NestedBlock[][] }) {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    data.set("columnsJson", JSON.stringify(next));
    isDirtyRef.current = false;
    startTransition(() => action(data));
  }
  function setColumnCount(count: number) {
    setColumnsState((current) => {
      const columnCount = clampColumnCount(count);
      const columns = Array.from(
        { length: columnCount },
        (_, index) => current.columns[index] ?? [],
      );
      const next = { columnCount, columns };
      submitColumns(next);
      return next;
    });
  }
  function addNestedBlock(columnIndex: number, type: NestableBlockType) {
    setColumnsState((current) => {
      const block = createDefaultNestedBlock(
        type,
        `nested_${Date.now()}_${nestedKeyRef.current++}`,
      );
      const columns = current.columns.map((column, index) =>
        index === columnIndex ? [...column, block] : column,
      );
      const next = { ...current, columns };
      submitColumns(next);
      return next;
    });
  }
  function removeNestedBlock(columnIndex: number, blockId: string) {
    setColumnsState((current) => {
      const columns = current.columns.map((column, index) =>
        index === columnIndex
          ? column.filter((block) => block.id !== blockId)
          : column,
      );
      const next = { ...current, columns };
      submitColumns(next);
      return next;
    });
  }
  function moveNestedBlock(columnIndex: number, blockId: string, offset: number) {
    setColumnsState((current) => {
      const column = current.columns[columnIndex] ?? [];
      const index = column.findIndex((block) => block.id === blockId);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= column.length) return current;
      const nextColumn = [...column];
      const [block] = nextColumn.splice(index, 1);
      if (!block) return current;
      nextColumn.splice(target, 0, block);
      const columns = current.columns.map((c, i) =>
        i === columnIndex ? nextColumn : c,
      );
      const next = { ...current, columns };
      submitColumns(next);
      return next;
    });
  }
  function moveNestedBlockToColumn(
    fromColumn: number,
    blockId: string,
    toColumn: number,
  ) {
    setColumnsState((current) => {
      if (fromColumn === toColumn) return current;
      const source = current.columns[fromColumn] ?? [];
      const block = source.find((item) => item.id === blockId);
      if (!block) return current;
      const columns = current.columns.map((column, index) => {
        if (index === fromColumn) {
          return column.filter((item) => item.id !== blockId);
        }
        if (index === toColumn) return [...column, block];
        return column;
      });
      const next = { ...current, columns };
      submitColumns(next);
      return next;
    });
  }
  // Field edits inside a nested block just update local state -- the
  // hidden columnsJson input below is controlled, so it stays in sync and
  // rides the same blur-triggered autosave as every other field.
  function updateNestedBlockPayload(
    columnIndex: number,
    blockId: string,
    patch: Record<string, unknown>,
  ) {
    setColumnsState((current) => {
      const columns = current.columns.map((column, index) =>
        index === columnIndex
          ? column.map((block) =>
              block.id === blockId
                ? { ...block, payload: { ...block.payload, ...patch } }
                : block,
            )
          : column,
      );
      return { ...current, columns };
    });
  }
  return (
    <form
      ref={formRef}
      action={action}
      data-cms-section-form={sectionId}
      onBlur={autosaveOnBlur}
      onChange={autosaveOnChange}
    >
      <input type="hidden" name="id" value={sectionId} />
      <input type="hidden" name="expectedVersion" value={version} />
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="revisionId" value={revisionId} />
      <input type="hidden" name="sectionType" value={sectionType} />
      {sectionType === "CASE_STUDY" || sectionType === "TESTIMONIAL" ? (
        <EvidenceFields sectionType={sectionType} payload={evidencePayload} />
      ) : null}
      {sectionType === "DIVIDER" || sectionType === "CUSTOM_HTML" ? (
        <div className="admin-form-grid">
          <label>
            Ordre
            <input type="number" name="order" min="0" defaultValue={order} />
          </label>
        </div>
      ) : (
        <>
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
        </>
      )}
      {sectionType === "CUSTOM_HTML" ? (
        <label>
          Code HTML
          <textarea
            name="html"
            rows={12}
            className="cms-html-field"
            defaultValue={String(evidencePayload.html ?? "")}
            spellCheck={false}
          />
        </label>
      ) : null}
      <SectionDesignFields
        payload={evidencePayload}
        images={images}
        worldKey={worldKey}
        editable={editable}
        hasPrimaryMedia={Boolean(hasPrimaryMedia)}
        primaryMediaId={mediaId}
      />
      {sectionType === "FORM" ? (
        <label>
          Type de formulaire
          <select
            name="formKey"
            defaultValue={String(evidencePayload.formKey ?? "CONTACT")}
          >
            <option value="CONTACT">Contact général</option>
            <option value="QUOTE">Demande de devis</option>
          </select>
        </label>
      ) : null}
      {hasItems ? (
        <fieldset className="cms-items-repeater">
          <legend>
            {sectionType === "FAQ" ? "Questions et réponses" : "Éléments"}
          </legend>
          <input type="hidden" name="hasItems" value="true" />
          {itemRows.map((row, index) => (
            <div className="cms-items-repeater__row" key={row.key}>
              <div className="cms-items-repeater__fields">
                <label>
                  {sectionType === "FAQ" ? "Question" : "Titre"}
                  <input
                    name="itemTitle"
                    defaultValue={row.title}
                    data-cms-item-index={index}
                    data-cms-item-field="title"
                  />
                </label>
                <label>
                  {sectionType === "FAQ" ? "Réponse" : "Description"}
                  <textarea
                    name="itemText"
                    rows={2}
                    defaultValue={row.text}
                    data-cms-item-index={index}
                    data-cms-item-field="text"
                  />
                </label>
              </div>
              <div className="cms-items-repeater__actions">
                <button
                  type="button"
                  aria-label="Monter cet élément"
                  onClick={() => moveItemRow(row.key, -1)}
                  disabled={!editable || index === 0}
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Descendre cet élément"
                  onClick={() => moveItemRow(row.key, 1)}
                  disabled={!editable || index === itemRows.length - 1}
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Supprimer cet élément"
                  className="is-danger"
                  onClick={() => removeItemRow(row.key)}
                  disabled={!editable}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="cms-items-repeater__add"
            onClick={addItemRow}
            disabled={!editable}
          >
            <Plus size={14} />{" "}
            {sectionType === "FAQ" ? "Ajouter une question" : "Ajouter un élément"}
          </button>
        </fieldset>
      ) : null}
      {sectionType === "COLUMNS" ? (
        <fieldset className="cms-columns-editor">
          <legend>Colonnes</legend>
          <input
            type="hidden"
            name="columnsJson"
            value={JSON.stringify(columnsState)}
            onChange={() => {}}
          />
          <label className="cms-columns-editor__count">
            Nombre de colonnes
            <select
              value={columnsState.columnCount}
              onChange={(event) =>
                setColumnCount(Number(event.target.value))
              }
              disabled={!editable}
            >
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </label>
          <div className="cms-columns-editor__grid">
            {columnsState.columns.map((column, columnIndex) => (
              <div className="cms-columns-editor__column" key={columnIndex}>
                <strong>Colonne {columnIndex + 1}</strong>
                {column.map((block, blockIndex) => (
                  <NestedBlockCard
                    key={block.id}
                    block={block}
                    columnIndex={columnIndex}
                    columnCount={columnsState.columnCount}
                    isFirst={blockIndex === 0}
                    isLast={blockIndex === column.length - 1}
                    images={images}
                    editable={editable}
                    onChangePayload={(patch) =>
                      updateNestedBlockPayload(columnIndex, block.id, patch)
                    }
                    onMove={(offset) =>
                      moveNestedBlock(columnIndex, block.id, offset)
                    }
                    onMoveToColumn={(target) =>
                      moveNestedBlockToColumn(columnIndex, block.id, target)
                    }
                    onRemove={() => removeNestedBlock(columnIndex, block.id)}
                  />
                ))}
                <NestedBlockAddForm
                  editable={editable}
                  onAdd={(type) => addNestedBlock(columnIndex, type)}
                />
              </div>
            ))}
          </div>
        </fieldset>
      ) : null}
      {hasMultipleMedia ? (
        <span className="cms-picker-label">Images du bloc</span>
      ) : null}
      {hasMultipleMedia ? (
        <input type="hidden" name="hasMediaIds" value="true" />
      ) : null}
      {hasMultipleMedia && images.length === 0 ? (
        <p className="admin-empty">
          Aucun média disponible.{" "}
          <Link href={`/workspace/site-content/media?world=${worldKey}`}>
            Ajoutez-en un dans la médiathèque
          </Link>
          , il apparaîtra ici.
        </p>
      ) : hasMultipleMedia ? (
        <div className="cms-image-picker" role="group">
          {images.map((asset) => (
            <label className="cms-image-picker__tile" key={asset.id}>
              <input
                type="checkbox"
                name="mediaIds"
                value={asset.id}
                defaultChecked={selectedMediaIds.includes(asset.id)}
                disabled={!editable}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.publicUrl} alt={asset.altText} />
              <span>{asset.title}</span>
            </label>
          ))}
        </div>
      ) : null}
      <Feedback state={state} />
      <div className="cms-autosave-row">
        <SubmitButton>Enregistrer</SubmitButton>
        <span className="cms-autosave-hint">
          Enregistrement automatique en quittant un champ
        </span>
      </div>
    </form>
  );
}

function NestedBlockCard({
  block,
  columnIndex,
  columnCount,
  isFirst,
  isLast,
  images,
  editable,
  onChangePayload,
  onMove,
  onMoveToColumn,
  onRemove,
}: Readonly<{
  block: NestedBlock;
  columnIndex: number;
  columnCount: number;
  isFirst: boolean;
  isLast: boolean;
  images: readonly ImageOption[];
  editable: boolean;
  onChangePayload: (patch: Record<string, unknown>) => void;
  onMove: (offset: number) => void;
  onMoveToColumn: (target: number) => void;
  onRemove: () => void;
}>) {
  const definition = getPageBlockDefinition(block.type);
  const value = (key: string) =>
    typeof block.payload[key] === "string" ? String(block.payload[key]) : "";
  const showLinkFields = block.type === "CTA" || block.type === "BANNER";
  const showMedia = block.type === "MEDIA" || block.type === "VIDEO";
  return (
    <div className="cms-nested-block">
      <header>
        <strong>{definition?.label ?? block.type}</strong>
        <button
          type="button"
          aria-label="Supprimer ce bloc imbriqué"
          className="is-danger"
          onClick={onRemove}
          disabled={!editable}
        >
          <Trash2 size={14} />
        </button>
      </header>
      <label>
        Sur-titre
        <input
          value={value("eyebrow")}
          onChange={(event) =>
            onChangePayload({ eyebrow: event.target.value })
          }
          disabled={!editable}
        />
      </label>
      <label>
        Titre
        <textarea
          rows={2}
          value={value("title")}
          onChange={(event) => onChangePayload({ title: event.target.value })}
          disabled={!editable}
        />
      </label>
      <label>
        Texte
        <textarea
          rows={2}
          value={value("text")}
          onChange={(event) => onChangePayload({ text: event.target.value })}
          disabled={!editable}
        />
      </label>
      {showLinkFields ? (
        <div className="admin-form-grid">
          <label>
            Libellé du bouton
            <input
              value={value("label")}
              onChange={(event) =>
                onChangePayload({ label: event.target.value })
              }
              disabled={!editable}
            />
          </label>
          <label>
            Lien du bouton
            <input
              value={value("href")}
              onChange={(event) =>
                onChangePayload({ href: event.target.value })
              }
              disabled={!editable}
            />
          </label>
        </div>
      ) : null}
      {showMedia ? (
        <label>
          {block.type === "VIDEO" ? "Fichier vidéo" : "Image"}
          <select
            value={value("mediaId")}
            onChange={(event) =>
              onChangePayload({ mediaId: event.target.value })
            }
            disabled={!editable}
          >
            <option value="">Aucune</option>
            {images.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="cms-nested-block__move">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={!editable || isFirst}
        >
          <ChevronUp size={14} /> Monter
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={!editable || isLast}
        >
          <ChevronDown size={14} /> Descendre
        </button>
        {columnCount > 1 ? (
          <label className="cms-nested-block__move-to">
            Déplacer vers
            <select
              value={columnIndex}
              onChange={(event) => onMoveToColumn(Number(event.target.value))}
              disabled={!editable}
            >
              {Array.from({ length: columnCount }, (_, index) => (
                <option key={index} value={index}>
                  Colonne {index + 1}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </div>
  );
}

function NestedBlockAddForm({
  editable,
  onAdd,
}: Readonly<{
  editable: boolean;
  onAdd: (type: NestableBlockType) => void;
}>) {
  const [type, setType] = useState<NestableBlockType>(
    NESTABLE_BLOCK_TYPES[0],
  );
  return (
    <div className="cms-columns-editor__add">
      <select
        value={type}
        onChange={(event) => setType(event.target.value as NestableBlockType)}
        disabled={!editable}
      >
        {NESTABLE_BLOCK_TYPES.map((blockType) => (
          <option key={blockType} value={blockType}>
            {getPageBlockDefinition(blockType)?.label ?? blockType}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => onAdd(type)} disabled={!editable}>
        <Plus size={14} /> Ajouter un bloc
      </button>
    </div>
  );
}

function SectionDesignFields({
  payload,
  images,
  worldKey,
  editable,
  hasPrimaryMedia,
  primaryMediaId,
}: Readonly<{
  payload: Readonly<Record<string, unknown>>;
  images: readonly ImageOption[];
  worldKey: string;
  editable: boolean;
  hasPrimaryMedia: boolean;
  primaryMediaId: string;
}>) {
  const selectedBackgroundId =
    typeof payload.backgroundMediaId === "string"
      ? payload.backgroundMediaId
      : "";
  const selected = (key: string, fallback: string) =>
    typeof payload[key] === "string" && payload[key]
      ? String(payload[key])
      : fallback;
  return (
    <fieldset className="cms-section-design-fields">
      <legend>Design du bloc</legend>
      <p className="admin-field-help">
        Ces réglages s’appliquent uniquement à ce bloc. « Hériter du site »
        conserve l’identité définie dans Apparence.
      </p>
      <div className="admin-form-grid cms-section-design-fields__grid">
        <label>
          Fond sémantique
          <select
            name="surfaceTone"
            defaultValue={selected("surfaceTone", "DEFAULT")}
            disabled={!editable}
          >
            <option value="DEFAULT">Standard</option>
            <option value="SUBTLE">Discret</option>
            <option value="BRAND">Marque</option>
            <option value="INVERSE">Contrasté</option>
          </select>
        </label>
        <label>
          Largeur du contenu
          <select
            name="contentWidth"
            defaultValue={selected("contentWidth", "STANDARD")}
            disabled={!editable}
          >
            <option value="NARROW">Étroite</option>
            <option value="STANDARD">Standard</option>
            <option value="WIDE">Large</option>
            <option value="FULL">Pleine largeur</option>
          </select>
        </label>
        <label>
          Densité
          <select
            name="sectionDensity"
            defaultValue={selected("sectionDensity", "COMFORTABLE")}
            disabled={!editable}
          >
            <option value="COMPACT">Compacte</option>
            <option value="COMFORTABLE">Confortable</option>
            <option value="SPACIOUS">Aérée</option>
          </select>
        </label>
        <label>
          Police du titre
          <select name="headingFont" defaultValue={selected("headingFont", "")}>
            <option value="">Hériter du site</option>
            {SITE_FONT_CHOICES.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </label>
        <label>
          Graisse du titre
          <select
            name="headingWeight"
            defaultValue={selected("headingWeight", "")}
          >
            <option value="">Hériter du thème</option>
            <option value="400">Normal</option>
            <option value="600">Semi-gras</option>
            <option value="700">Gras</option>
            <option value="800">Très gras</option>
            <option value="900">Noir</option>
          </select>
        </label>
        <label>
          Style du titre
          <select
            name="headingStyle"
            defaultValue={selected("headingStyle", "")}
          >
            <option value="">Hériter du thème</option>
            <option value="normal">Normal</option>
            <option value="italic">Italique</option>
          </select>
        </label>
        <label>
          Police du texte
          <select name="bodyFont" defaultValue={selected("bodyFont", "")}>
            <option value="">Hériter du site</option>
            {SITE_FONT_CHOICES.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </label>
        <label>
          Graisse du texte
          <select name="bodyWeight" defaultValue={selected("bodyWeight", "")}>
            <option value="">Hériter du thème</option>
            <option value="400">Normal</option>
            <option value="500">Moyen</option>
            <option value="600">Semi-gras</option>
            <option value="700">Gras</option>
          </select>
        </label>
        <label>
          Style du texte
          <select name="bodyStyle" defaultValue={selected("bodyStyle", "")}>
            <option value="">Hériter du thème</option>
            <option value="normal">Normal</option>
            <option value="italic">Italique</option>
          </select>
        </label>
      </div>
      <div className="admin-form-grid cms-section-design-fields__grid">
        <label>
          Lisibilité du texte
          <select name="textTone" defaultValue={selected("textTone", "AUTO")}>
            <option value="AUTO">Automatique</option>
            <option value="LIGHT">Texte clair</option>
            <option value="DARK">Texte foncé</option>
          </select>
        </label>
      </div>
      {hasPrimaryMedia ? (
        <div className="cms-section-design-fields__media-group">
          <ImageRadioPicker
            name="mediaId"
            label="Image principale du bloc"
            emptyLabel="Aucune image principale"
            selectedId={primaryMediaId}
            images={images}
            worldKey={worldKey}
            editable={editable}
          />
          <PrimaryImageAdjustments payload={payload} editable={editable} />
        </div>
      ) : null}
      <div className="cms-section-design-fields__media-group">
        <span className="cms-picker-label">Image d’arrière-plan</span>
        {images.length === 0 ? (
          <p className="admin-empty">
            Aucun média disponible.{" "}
            <Link href={`/workspace/site-content/media?world=${worldKey}`}>
              Ouvrir la médiathèque
            </Link>
            .
          </p>
        ) : (
          <div
            className="cms-image-picker"
            role="radiogroup"
            aria-label="Image d’arrière-plan"
          >
            <label className="cms-image-picker__tile cms-image-picker__tile--empty">
              <input
                type="radio"
                name="backgroundMediaId"
                value=""
                defaultChecked={!selectedBackgroundId}
                disabled={!editable}
              />
              <span>Aucun arrière-plan</span>
            </label>
            {images.map((asset) => (
              <label className="cms-image-picker__tile" key={asset.id}>
                <input
                  type="radio"
                  name="backgroundMediaId"
                  value={asset.id}
                  defaultChecked={selectedBackgroundId === asset.id}
                  disabled={!editable}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.publicUrl} alt={asset.altText} />
                <span>{asset.title}</span>
              </label>
            ))}
          </div>
        )}
        <BackgroundImageAdjustments payload={payload} editable={editable} />
      </div>
      <div className="cms-responsive-visibility">
        <input type="hidden" name="hasResponsiveVisibility" value="true" />
        <span className="cms-picker-label">Visibilité responsive</span>
        <label>
          <input
            type="checkbox"
            name="hideOnDesktop"
            defaultChecked={payload.hideOnDesktop === true}
            disabled={!editable}
          />
          Masquer sur ordinateur
        </label>
        <label>
          <input
            type="checkbox"
            name="hideOnTablet"
            defaultChecked={payload.hideOnTablet === true}
            disabled={!editable}
          />
          Masquer sur tablette
        </label>
        <label>
          <input
            type="checkbox"
            name="hideOnMobile"
            defaultChecked={payload.hideOnMobile === true}
            disabled={!editable}
          />
          Masquer sur mobile
        </label>
      </div>
    </fieldset>
  );
}

function PrimaryImageAdjustments({
  payload,
  editable,
}: Readonly<{
  payload: Readonly<Record<string, unknown>>;
  editable: boolean;
}>) {
  return (
    <details className="cms-image-adjustments" open>
      <summary>Recadrage et dimensions de l’image principale</summary>
      <div className="cms-image-adjustments__body">
        <label>
          Mode de recadrage
          <select
            name="imageFit"
            defaultValue={sectionImageFormValue(payload, "imageFit")}
            disabled={!editable}
          >
            <option value="COVER">Remplir le cadre et rogner</option>
            <option value="CONTAIN">Afficher l’image entière</option>
          </select>
        </label>
        <RangeField
          name="imageOpacity"
          label="Opacité de l’image"
          value={sectionImageFormValue(payload, "imageOpacity")}
          min={0}
          max={100}
          unit="%"
          disabled={!editable}
        />
        <label>
          Couleur du voile
          <select
            name="imageOverlayColor"
            defaultValue={sectionImageFormValue(payload, "imageOverlayColor")}
            disabled={!editable}
          >
            <option value="BLACK">Noir</option>
            <option value="WHITE">Blanc</option>
            <option value="ACCENT">Couleur de la marque</option>
          </select>
        </label>
        <RangeField
          name="imageOverlayOpacity"
          label="Opacité du voile"
          value={sectionImageFormValue(payload, "imageOverlayOpacity")}
          min={0}
          max={100}
          unit="%"
          disabled={!editable}
        />
        <RangeField
          name="imageZoom"
          label="Zoom dans l’image"
          value={sectionImageFormValue(payload, "imageZoom")}
          min={100}
          max={200}
          unit="%"
          disabled={!editable}
        />
        <RangeField
          name="imagePositionX"
          label="Cadrage horizontal"
          value={sectionImageFormValue(payload, "imagePositionX")}
          min={0}
          max={100}
          unit="%"
          disabled={!editable}
        />
        <RangeField
          name="imagePositionY"
          label="Cadrage vertical"
          value={sectionImageFormValue(payload, "imagePositionY")}
          min={0}
          max={100}
          unit="%"
          disabled={!editable}
        />
        <RangeField
          name="imageWidth"
          label="Largeur dans le bloc"
          value={sectionImageFormValue(payload, "imageWidth")}
          min={20}
          max={100}
          unit="%"
          disabled={!editable}
        />
        <RangeField
          name="imageHeight"
          label="Hauteur du cadre"
          value={sectionImageFormValue(payload, "imageHeight")}
          min={0}
          max={1200}
          step={20}
          unit="px"
          zeroLabel="Automatique"
          disabled={!editable}
        />
      </div>
    </details>
  );
}

function BackgroundImageAdjustments({
  payload,
  editable,
}: Readonly<{
  payload: Readonly<Record<string, unknown>>;
  editable: boolean;
}>) {
  return (
    <details className="cms-image-adjustments" open>
      <summary>Cadrage et voile de l’arrière-plan</summary>
      <div className="cms-image-adjustments__body">
        <RangeField
          name="backgroundImageOpacity"
          label="Opacité de l’image"
          value={sectionImageFormValue(payload, "backgroundImageOpacity")}
          min={0}
          max={100}
          unit="%"
          disabled={!editable}
        />
        <RangeField
          name="backgroundZoom"
          label="Zoom dans l’image"
          value={sectionImageFormValue(payload, "backgroundZoom")}
          min={100}
          max={200}
          unit="%"
          disabled={!editable}
        />
        <RangeField
          name="backgroundPositionX"
          label="Cadrage horizontal"
          value={sectionImageFormValue(payload, "backgroundPositionX")}
          min={0}
          max={100}
          unit="%"
          disabled={!editable}
        />
        <RangeField
          name="backgroundPositionY"
          label="Cadrage vertical"
          value={sectionImageFormValue(payload, "backgroundPositionY")}
          min={0}
          max={100}
          unit="%"
          disabled={!editable}
        />
        <label>
          Couleur du voile
          <select
            name="backgroundOverlayColor"
            defaultValue={sectionImageFormValue(
              payload,
              "backgroundOverlayColor",
            )}
            disabled={!editable}
          >
            <option value="BLACK">Noir</option>
            <option value="WHITE">Blanc</option>
            <option value="ACCENT">Couleur de la marque</option>
          </select>
        </label>
        <RangeField
          name="backgroundOverlayOpacity"
          label="Opacité du voile"
          value={sectionImageFormValue(payload, "backgroundOverlayOpacity")}
          min={0}
          max={100}
          unit="%"
          disabled={!editable}
        />
      </div>
    </details>
  );
}

function SerpPreview({
  title,
  description,
  path,
}: Readonly<{ title: string; description: string; path: string }>) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return (
    <div className="cms-serp-preview">
      <span className="cms-serp-preview__label">Aperçu dans Google</span>
      <div className="cms-serp-preview__card">
        <span className="cms-serp-preview__url">
          {origin}
          {path}
        </span>
        <strong className="cms-serp-preview__title">
          {title || "Titre de la page"}
        </strong>
        <p className="cms-serp-preview__description">
          {description || "Aucune description SEO renseignée pour le moment."}
        </p>
      </div>
    </div>
  );
}

function CharCounterField({
  label,
  name,
  defaultValue,
  maxLength,
  multiline = false,
  disabled = false,
  onValueChange,
}: Readonly<{
  label: string;
  name: string;
  defaultValue: string;
  maxLength: number;
  multiline?: boolean;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
}>) {
  const [length, setLength] = useState(defaultValue.length);
  const remaining = maxLength - length;
  function handleChange(value: string) {
    setLength(value.length);
    onValueChange?.(value);
  }
  return (
    <label>
      <span className="cms-char-counter__head">
        {label}
        <span
          className={
            remaining < 0
              ? "cms-char-counter cms-char-counter--over"
              : "cms-char-counter"
          }
        >
          {length}/{maxLength}
        </span>
      </span>
      {multiline ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          maxLength={maxLength}
          disabled={disabled}
          onChange={(event) => handleChange(event.target.value)}
        />
      ) : (
        <input
          name={name}
          defaultValue={defaultValue}
          maxLength={maxLength}
          disabled={disabled}
          onChange={(event) => handleChange(event.target.value)}
        />
      )}
    </label>
  );
}

function RangeField({
  name,
  label,
  value: initialValue,
  min,
  max,
  step = 1,
  unit,
  zeroLabel,
  disabled,
}: Readonly<{
  name: string;
  label: string;
  value: string;
  min: number;
  max: number;
  step?: number;
  unit: string;
  zeroLabel?: string;
  disabled: boolean;
}>) {
  const [value, setValue] = useState(initialValue);
  return (
    <label className="cms-range-field">
      <span>
        {label}
        <output>
          {value === "0" && zeroLabel ? zeroLabel : `${value}${unit}`}
        </output>
      </span>
      <input
        type="range"
        name={name}
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={(event) => setValue(event.currentTarget.value)}
        onChange={(event) => setValue(event.currentTarget.value)}
        disabled={disabled}
      />
    </label>
  );
}

function ImageRadioPicker({
  name,
  label,
  emptyLabel,
  selectedId,
  images,
  worldKey,
  editable,
}: Readonly<{
  name: string;
  label: string;
  emptyLabel: string;
  selectedId: string;
  images: readonly ImageOption[];
  worldKey: string;
  editable: boolean;
}>) {
  return (
    <div className="cms-section-design-fields__media">
      <span className="cms-picker-label">{label}</span>
      {images.length === 0 ? (
        <p className="admin-empty">
          Aucun média disponible.{" "}
          <Link href={`/workspace/site-content/media?world=${worldKey}`}>
            Ouvrir la médiathèque
          </Link>
          .
        </p>
      ) : (
        <div className="cms-image-picker" role="radiogroup" aria-label={label}>
          <label className="cms-image-picker__tile cms-image-picker__tile--empty">
            <input
              type="radio"
              name={name}
              value=""
              defaultChecked={!selectedId}
              disabled={!editable}
            />
            <span>{emptyLabel}</span>
          </label>
          {images.map((asset) => (
            <label className="cms-image-picker__tile" key={asset.id}>
              <input
                type="radio"
                name={name}
                value={asset.id}
                defaultChecked={selectedId === asset.id}
                disabled={!editable}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.publicUrl} alt={asset.altText} />
              <span>{asset.title}</span>
            </label>
          ))}
        </div>
      )}
    </div>
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
  revisionId,
  sectionType,
  order,
  payload,
  editable,
}: Readonly<{
  sectionId?: string;
  version?: number;
  pageId: string;
  revisionId: string;
  sectionType?: string;
  order: number;
  payload: string;
  editable: boolean;
}>) {
  const [state, action] = useActionState(saveSectionAction, IDLE_ACTION_STATE);
  useRefreshOnSuccess(state.status);
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
      <input type="hidden" name="revisionId" value={revisionId} />
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

export function UploadMediaForm({ worldKey }: Readonly<{ worldKey: string }>) {
  const [state, action] = useActionState(uploadMediaAction, IDLE_ACTION_STATE);
  const [imageInfo, setImageInfo] = useState<{
    width: number;
    height: number;
    hasAlpha: boolean;
  } | null>(null);
  useRefreshOnSuccess(state.status);
  async function inspectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setImageInfo(null);
    if (!file?.type.startsWith("image/")) return;
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    const sampleWidth = Math.min(bitmap.width, 320);
    const sampleHeight = Math.max(
      1,
      Math.round((bitmap.height / bitmap.width) * sampleWidth),
    );
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context?.drawImage(bitmap, 0, 0, sampleWidth, sampleHeight);
    const pixels = context?.getImageData(0, 0, sampleWidth, sampleHeight).data;
    let hasAlpha = false;
    if (pixels) {
      for (let index = 3; index < pixels.length; index += 4) {
        if ((pixels[index] ?? 255) < 255) {
          hasAlpha = true;
          break;
        }
      }
    }
    setImageInfo({ width: bitmap.width, height: bitmap.height, hasAlpha });
    bitmap.close();
  }
  return (
    <form action={action} className="admin-form-card cms-create-card">
      <h2>Ajouter un média</h2>
      <input type="hidden" name="worldKey" value={worldKey} />
      <label>
        Fichier
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          required
          onChange={inspectImage}
        />
      </label>
      {imageInfo ? (
        <div className="cms-media-preflight" role="status">
          <strong>
            {imageInfo.width} × {imageInfo.height} px
          </strong>
          <span>
            {imageInfo.hasAlpha
              ? "Transparence réelle détectée."
              : "Aucune transparence réelle détectée : le fond visible fait partie du fichier."}
          </span>
          <input type="hidden" name="width" value={imageInfo.width} />
          <input type="hidden" name="height" value={imageInfo.height} />
        </div>
      ) : null}
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
        comme image principale ou arrière-plan dans l’éditeur de pages.
      </p>
    </form>
  );
}

export function EditMediaDetailsForm({
  mediaId,
  title,
  altText,
  caption,
  credit,
  rightsStatement,
  rightsExpiresAt,
  tags,
}: Readonly<{
  mediaId: string;
  title: string;
  altText: string;
  caption: string;
  credit: string;
  rightsStatement: string;
  rightsExpiresAt: string;
  tags: string;
}>) {
  const [state, action] = useActionState(
    updateMediaDetailsAction,
    IDLE_ACTION_STATE,
  );
  useRefreshOnSuccess(state.status);
  return (
    <form action={action} className="cms-media-details-form">
      <input type="hidden" name="id" value={mediaId} />
      <label>
        Titre
        <input name="title" defaultValue={title} />
      </label>
      <label>
        Texte alternatif
        <input name="altText" defaultValue={altText} />
      </label>
      <label>
        Tags
        <input name="tags" defaultValue={tags} placeholder="équipe, campagne, print" />
      </label>
      <label>
        Légende
        <input name="caption" defaultValue={caption} />
      </label>
      <label>
        Crédit
        <input name="credit" defaultValue={credit} placeholder="Nom du photographe ou de la source" />
      </label>
      <label>
        Mention de droits
        <input
          name="rightsStatement"
          defaultValue={rightsStatement}
          placeholder="Licence achetée, usage interne, libre de droits…"
        />
      </label>
      <label>
        Droits valables jusqu’au
        <input type="date" name="rightsExpiresAt" defaultValue={rightsExpiresAt} />
      </label>
      <SubmitButton>Enregistrer les détails</SubmitButton>
      <Feedback state={state} />
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
