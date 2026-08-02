"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, type ChangeEvent } from "react";

import type {
  WorkspaceRevisionDto,
  WorkspaceSiteIdentityDto,
  WorkspacePageDto,
} from "@/modules/content/application/workspace-content-query";
import { getPageBlockDefinition } from "@/modules/content/domain/page-block-registry";
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
  createPageAction,
  deleteMediaAction,
  deleteSectionAction,
  saveSectionAction,
  saveSectionFieldsAction,
  saveSiteIdentityDraftAction,
  restorePageRevisionAction,
  startPageRevisionAction,
  startSiteIdentityDraftAction,
  transitionSiteIdentityAction,
  transitionPageRevisionAction,
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

export function RevisionEditor({
  pageId,
  draft,
  published,
  history,
  changeSummary,
}: Readonly<{
  pageId: string;
  draft: WorkspaceRevisionDto | null;
  published: WorkspaceRevisionDto | null;
  history: readonly WorkspaceRevisionDto[];
  changeSummary: Readonly<{
    added: readonly string[];
    removed: readonly string[];
    modified: readonly string[];
    moved: readonly string[];
    totalChanges: number;
  }> | null;
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
        <RevisionHistory pageId={pageId} revisions={history} restorable />
      </section>
    );
  }
  return (
    <>
      <ActiveRevisionEditor pageId={pageId} revision={draft} />
      {changeSummary ? <RevisionChangeSummary summary={changeSummary} /> : null}
      <RevisionHistory pageId={pageId} revisions={history} restorable={false} />
    </>
  );
}

function RevisionChangeSummary({
  summary,
}: Readonly<{
  summary: Readonly<{
    added: readonly string[];
    removed: readonly string[];
    modified: readonly string[];
    moved: readonly string[];
    totalChanges: number;
  }>;
}>) {
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
        groups.map(([label, values]) =>
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
        )
      )}
    </section>
  );
}

function RevisionHistory({
  pageId,
  revisions,
  restorable,
}: Readonly<{
  pageId: string;
  revisions: readonly WorkspaceRevisionDto[];
  restorable: boolean;
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
            {restorable ? (
              <RestoreRevisionForm pageId={pageId} revisionId={revision.id} />
            ) : null}
          </li>
        ))}
      </ol>
    </details>
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
                <label>
                  Description SEO par défaut
                  <textarea
                    name="defaultSeoDescription"
                    rows={3}
                    defaultValue={config.defaultSeoDescription}
                    maxLength={180}
                  />
                </label>
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
}: Readonly<{
  name: string;
  label: string;
  selectedId: string;
  images: readonly ImageOption[];
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

function ActiveRevisionEditor({
  pageId,
  revision,
}: Readonly<{ pageId: string; revision: WorkspaceRevisionDto }>) {
  const [saveState, saveAction] = useActionState(
    updatePageRevisionMetadataAction,
    IDLE_ACTION_STATE,
  );
  useRefreshOnSuccess(saveState.status);
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
          <label>
            Titre SEO
            <input
              name="seoTitle"
              defaultValue={revision.seoTitle ?? ""}
              maxLength={70}
              disabled={revision.status !== "DRAFT"}
            />
          </label>
          <label>
            Description SEO
            <textarea
              name="seoDescription"
              defaultValue={revision.seoDescription ?? ""}
              maxLength={180}
              disabled={revision.status !== "DRAFT"}
            />
          </label>
        </div>
        {revision.status === "DRAFT" ? (
          <SubmitButton>Enregistrer la version</SubmitButton>
        ) : null}
        <Feedback state={saveState} />
      </form>
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
  const itemsText = Array.isArray(evidencePayload.items)
    ? evidencePayload.items
        .map((item) => {
          if (!item || typeof item !== "object") return "";
          const record = item as Record<string, unknown>;
          return `${String(record.title ?? "")} | ${String(record.text ?? "")}`;
        })
        .filter(Boolean)
        .join("\n")
    : "";
  return (
    <form action={action} data-cms-section-form={sectionId}>
      <input type="hidden" name="id" value={sectionId} />
      <input type="hidden" name="expectedVersion" value={version} />
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="revisionId" value={revisionId} />
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
        <label>
          {sectionType === "FAQ" ? "Questions et réponses" : "Éléments"}
          <textarea
            name="itemsText"
            rows={6}
            defaultValue={itemsText}
            placeholder={
              sectionType === "FAQ"
                ? "Question | Réponse (une par ligne)"
                : "Titre | Description (un par ligne)"
            }
          />
        </label>
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
      <SubmitButton>Mettre à jour</SubmitButton>
    </form>
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
