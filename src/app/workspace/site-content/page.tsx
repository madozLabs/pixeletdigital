/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  FileText,
  Globe,
  Image as ImageIcon,
  Layers,
  PlusCircle,
  UploadCloud,
} from "lucide-react";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/shared/prisma-client";
import { parsePage, toSkipTake } from "@/shared/pagination";
import { LifecycleBadge } from "../_components/status-badge";
import { Pagination } from "../_components/pagination";
import { getWorkspaceRequestContext } from "../get-workspace-context";
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
  "CTA",
  "PORTFOLIO",
];

const TYPED_SECTION_TYPES = new Set(["HERO", "TEXT", "MEDIA", "CTA"]);

type MediaAsset = Awaited<
  ReturnType<typeof prisma.mediaAsset.findMany>
>[number];

export default async function SiteContentPage({
  searchParams,
}: {
  searchParams: Promise<{
    world?: string;
    page?: string;
    tab?: string;
    listPage?: string;
  }>;
}) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");
  const now = context.clock.now();
  const params = await searchParams;
  const worldKey = params.world ?? "pixel-digital";
  const tab = params.tab ?? "overview";
  const listPageParams = parsePage(params.listPage);
  const { skip: listSkip, take: listTake } = toSkipTake(listPageParams);

  // The editor's media picker needs to see every asset to select from, so it
  // is only fetched when actually editing a page rather than on every load.
  const needsFullMediaForEditor = Boolean(params.page) && tab !== "media";

  const [
    recentPages,
    homePage,
    totalPages,
    publishedCount,
    draftCount,
    totalMedia,
    pagesForTab,
    mediaForTab,
    fullMediaForEditor,
    publishedServices,
    enquiryCount,
  ] = await Promise.all([
    prisma.page
      .findMany({ where: { worldKey }, orderBy: { updatedAt: "desc" }, take: 6 })
      .catch(() => []),
    prisma.page
      .findFirst({ where: { worldKey, slug: "accueil" } })
      .catch(() => null),
    prisma.page.count({ where: { worldKey } }).catch(() => 0),
    prisma.page
      .count({ where: { worldKey, lifecycle: "PUBLISHED" } })
      .catch(() => 0),
    prisma.page
      .count({ where: { worldKey, lifecycle: "DRAFT" } })
      .catch(() => 0),
    prisma.mediaAsset.count({ where: { worldKey } }).catch(() => 0),
    tab === "pages"
      ? prisma.page
          .findMany({
            where: { worldKey },
            orderBy: { updatedAt: "desc" },
            skip: listSkip,
            take: listTake,
          })
          .catch(() => [])
      : Promise.resolve([]),
    tab === "media"
      ? prisma.mediaAsset
          .findMany({
            where: { worldKey },
            orderBy: { createdAt: "desc" },
            skip: listSkip,
            take: listTake,
          })
          .catch(() => [])
      : Promise.resolve([]),
    needsFullMediaForEditor
      ? prisma.mediaAsset
          .findMany({ where: { worldKey }, orderBy: { createdAt: "desc" } })
          .catch(() => [])
      : Promise.resolve([]),
    prisma.service
      .count({ where: { worldKey, lifecycle: "PUBLISHED" } })
      .catch(() => 0),
    prisma.enquiry.count({ where: { worldKey } }).catch(() => 0),
  ]);
  const selectedPage = params.page
    ? await prisma.page
        .findUnique({
          where: { id: params.page },
          include: { sections: { orderBy: { order: "asc" } } },
        })
        .catch(() => null)
    : null;

  const totalListPages = Math.max(
    1,
    Math.ceil(
      (tab === "media" ? totalMedia : totalPages) / listPageParams.pageSize,
    ),
  );

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-content__title">Site &amp; contenus</h1>
          <p className="admin-content__lede">
            Pilotez le site public : pages, sections, médias et publication.
          </p>
        </div>
        <span className="admin-metric">
          {publishedCount} page{publishedCount > 1 ? "s" : ""} en ligne
        </span>
      </div>

      <div className="admin-tabs" role="tablist">
        {(
          [
            ["overview", "Vue d’ensemble"],
            ["pages", "Pages"],
            ["media", "Médiathèque"],
          ] as const
        ).map(([id, label]) => (
          <Link
            key={id}
            className={
              tab === id
                ? "admin-tabs__item admin-tabs__item--active"
                : "admin-tabs__item"
            }
            href={`/workspace/site-content?world=${worldKey}&tab=${id}`}
          >
            {label}
            {id === "pages" ? (
              <span className="admin-tabs__count">{totalPages}</span>
            ) : null}
            {id === "media" ? (
              <span className="admin-tabs__count">{totalMedia}</span>
            ) : null}
          </Link>
        ))}
      </div>

      {tab === "overview" ? (
        <OverviewPanel
          worldKey={worldKey}
          recentPages={recentPages}
          homePage={homePage}
          publishedCount={publishedCount}
          draftCount={draftCount}
          mediaCount={totalMedia}
          publishedServices={publishedServices}
          enquiryCount={enquiryCount}
        />
      ) : tab === "media" ? (
        <>
          <MediaPanel worldKey={worldKey} media={mediaForTab} now={now} />
          <Pagination
            basePath="/workspace/site-content"
            searchParams={{ world: worldKey, tab: "media" }}
            page={listPageParams.page}
            totalPages={totalListPages}
            total={totalMedia}
          />
        </>
      ) : selectedPage ? (
        <PageEditor
          worldKey={worldKey}
          page={selectedPage}
          media={fullMediaForEditor}
        />
      ) : (
        <>
          <PagesPanel worldKey={worldKey} pages={pagesForTab} />
          <Pagination
            basePath="/workspace/site-content"
            searchParams={{ world: worldKey, tab: "pages" }}
            page={listPageParams.page}
            totalPages={totalListPages}
            total={totalPages}
          />
        </>
      )}
    </>
  );
}

function OverviewPanel({
  worldKey,
  recentPages,
  homePage,
  publishedCount,
  draftCount,
  mediaCount,
  publishedServices,
  enquiryCount,
}: {
  worldKey: string;
  recentPages: Awaited<ReturnType<typeof prisma.page.findMany>>;
  homePage: Awaited<ReturnType<typeof prisma.page.findFirst>>;
  publishedCount: number;
  draftCount: number;
  mediaCount: number;
  publishedServices: number;
  enquiryCount: number;
}) {
  const recent = recentPages;
  return (
    <div className="cms-overview">
      <section className="dashboard-metrics cms-overview__metrics">
        <GlanceCard
          tone="accent"
          icon={<Globe size={20} />}
          label="Pages publiées"
          value={publishedCount}
          href={`/workspace/site-content?world=${worldKey}&tab=pages`}
        />
        <GlanceCard
          tone="info"
          icon={<FileText size={20} />}
          label="Brouillons"
          value={draftCount}
          href={`/workspace/site-content?world=${worldKey}&tab=pages`}
        />
        <GlanceCard
          tone="violet"
          icon={<ImageIcon size={20} />}
          label="Médias"
          value={mediaCount}
          href={`/workspace/site-content?world=${worldKey}&tab=media`}
        />
        <GlanceCard
          tone="success"
          icon={<Layers size={20} />}
          label="Services en ligne"
          value={publishedServices}
          href={`/workspace/services?world=${worldKey}`}
        />
      </section>

      <div className="cms-overview__grid">
        <section className="dashboard-panel">
          <h2>Dernières pages modifiées</h2>
          {recent.length === 0 ? (
            <p className="admin-empty">
              Aucune page. Créez la page « accueil » pour piloter le contenu du
              site public depuis le Workspace.
            </p>
          ) : (
            <ul>
              {recent.map((page) => (
                <li key={page.id}>
                  <strong>
                    <Link
                      href={`/workspace/site-content?world=${worldKey}&tab=pages&page=${page.id}`}
                    >
                      {page.title}
                    </Link>
                  </strong>
                  <span>
                    /{page.slug} · <LifecycleBadge lifecycle={page.lifecycle} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dashboard-panel">
          <h2>Actions rapides</h2>
          <ul className="cms-quick-actions">
            <li>
              <PlusCircle size={16} />
              <Link
                href={`/workspace/site-content?world=${worldKey}&tab=pages`}
              >
                Créer ou éditer une page
              </Link>
            </li>
            <li>
              <UploadCloud size={16} />
              <Link
                href={`/workspace/site-content?world=${worldKey}&tab=media`}
              >
                Ajouter un média
              </Link>
            </li>
            <li>
              <Layers size={16} />
              <Link href={`/workspace/services?world=${worldKey}`}>
                Gérer le catalogue de services
              </Link>
            </li>
            <li>
              <Globe size={16} />
              <a
                href={worldKey === "kwaliti-print" ? "/kwaliti-print" : "/"}
                target="_blank"
                rel="noreferrer"
              >
                Voir le site public
              </a>
            </li>
          </ul>
          <p className="admin-table__note">
            {homePage
              ? `La page « accueil » pilote le hero et l’appel à l’action du site ${worldKey === "kwaliti-print" ? "Kwaliti Print" : "Pixel&Digital"}.`
              : "Astuce : une page publiée avec le slug « accueil » remplace les textes du hero et du bloc final du site public."}{" "}
            {enquiryCount > 0
              ? `${enquiryCount} demande${enquiryCount > 1 ? "s" : ""} de contact reçue${enquiryCount > 1 ? "s" : ""} via le site.`
              : ""}
          </p>
        </section>
      </div>
    </div>
  );
}

function GlanceCard({
  tone,
  icon,
  label,
  value,
  href,
}: {
  tone: string;
  icon: ReactNode;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href} className="dashboard-metric-card">
      <span className={`metric-icon metric-icon--${tone}`}>{icon}</span>
      <span className="dashboard-metric-card__body">
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
    </Link>
  );
}

function PagesPanel({
  worldKey,
  pages,
}: {
  worldKey: string;
  pages: Awaited<ReturnType<typeof prisma.page.findMany>>;
}) {
  return (
    <div className="cms-layout">
      <form
        action={createPageAction}
        className="admin-form-card cms-create-card"
      >
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
        <button className="admin-table__action" type="submit">
          Créer la page
        </button>
        <p className="section__note">
          Le slug « accueil » pilote le hero du site public de l’univers.
        </p>
      </form>
      <section className="cms-list-panel">
        <h2>Pages de l’univers</h2>
        {pages.length === 0 ? (
          <p className="admin-empty">Aucune page.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Titre</th>
                  <th>Slug</th>
                  <th>Cycle</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.id}>
                    <td>{page.title}</td>
                    <td>/{page.slug}</td>
                    <td>
                      <LifecycleBadge lifecycle={page.lifecycle} />
                    </td>
                    <td>
                      <Link
                        className="admin-table__action"
                        href={`/workspace/site-content?world=${worldKey}&tab=pages&page=${page.id}`}
                      >
                        Éditer
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

type EditablePage = Prisma.PageGetPayload<{ include: { sections: true } }>;

function PageEditor({
  worldKey,
  page,
  media,
}: {
  worldKey: string;
  page: EditablePage;
  media: readonly MediaAsset[];
}) {
  return (
    <div className="cms-editor">
      <div className="cms-editor__top">
        <Link href={`/workspace/site-content?world=${worldKey}&tab=pages`}>
          ← Toutes les pages
        </Link>
        <LifecycleBadge lifecycle={page.lifecycle} />
      </div>
      <form action={updatePageAction} className="admin-form-card">
        <input type="hidden" name="id" value={page.id} />
        <input type="hidden" name="expectedVersion" value={page.version} />
        <div className="admin-form-grid">
          <label>
            Titre
            <input name="title" defaultValue={page.title} required />
          </label>
          <label>
            Slug
            <input name="slug" defaultValue={page.slug} required />
          </label>
        </div>
        <button
          className="admin-table__action"
          disabled={page.lifecycle !== "DRAFT"}
        >
          Enregistrer
        </button>
      </form>
      <PageWorkflow page={page} />
      <h2>Sections</h2>
      <div className="cms-sections">
        {page.sections.map((section) => (
          <SectionEditor
            key={section.id}
            page={page}
            section={section}
            media={media}
          />
        ))}
        {page.lifecycle === "DRAFT" ? (
          <NewSectionForm pageId={page.id} order={page.sections.length} />
        ) : null}
      </div>
    </div>
  );
}

function SectionEditor({
  page,
  section,
  media,
}: {
  page: EditablePage;
  section: EditablePage["sections"][number];
  media: readonly MediaAsset[];
}) {
  const payload = section.payload as Record<string, unknown>;
  const value = (key: string) =>
    typeof payload[key] === "string" ? (payload[key] as string) : "";
  const disabled = page.lifecycle !== "DRAFT";
  const typed = TYPED_SECTION_TYPES.has(section.sectionType);
  const images = media.filter((asset) => asset.mimeType.startsWith("image/"));

  return (
    <div className="admin-form-card cms-section-card">
      <header className="cms-section-card__head">
        <h3>
          {section.sectionType} · position {section.order}
        </h3>
        {!disabled ? (
          <form action={deleteSectionAction}>
            <input type="hidden" name="id" value={section.id} />
            <button className="admin-table__action" type="submit">
              Supprimer
            </button>
          </form>
        ) : null}
      </header>

      {typed ? (
        <form action={saveSectionFieldsAction}>
          <input type="hidden" name="id" value={section.id} />
          <input type="hidden" name="pageId" value={page.id} />
          <input type="hidden" name="sectionType" value={section.sectionType} />
          <div className="admin-form-grid">
            <label>
              Ordre
              <input
                type="number"
                name="order"
                min="0"
                defaultValue={section.order}
              />
            </label>
            <label>
              Sur-titre
              <input name="eyebrow" defaultValue={value("eyebrow")} />
            </label>
          </div>
          <label>
            Titre{" "}
            {section.sectionType === "HERO"
              ? "(une ligne par retour à la ligne)"
              : ""}
            <textarea name="title" rows={3} defaultValue={value("title")} />
          </label>
          <label>
            Texte
            <textarea name="text" rows={3} defaultValue={value("text")} />
          </label>
          <div className="admin-form-grid">
            <label>
              Libellé du bouton
              <input name="label" defaultValue={value("label")} />
            </label>
            <label>
              Lien du bouton
              <input name="href" defaultValue={value("href")} />
            </label>
          </div>
          <span className="cms-picker-label">Image</span>
          {images.length === 0 ? (
            <p className="admin-empty">
              Aucun média disponible.{" "}
              <Link
                href={`/workspace/site-content?world=${page.worldKey}&tab=media`}
              >
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
                  defaultChecked={value("mediaId") === ""}
                  disabled={disabled}
                />
                <span>Aucune image</span>
              </label>
              {images.map((asset) => (
                <label className="cms-image-picker__tile" key={asset.id}>
                  <input
                    type="radio"
                    name="mediaId"
                    value={asset.id}
                    defaultChecked={value("mediaId") === asset.id}
                    disabled={disabled}
                  />
                  <img src={asset.publicUrl} alt={asset.altText} />
                  <span>{asset.title}</span>
                </label>
              ))}
            </div>
          )}
          <button className="admin-table__action" disabled={disabled}>
            Mettre à jour
          </button>
        </form>
      ) : null}

      <details className="admin-user-card__details">
        <summary>{typed ? "Mode avancé (JSON)" : "Contenu (JSON)"}</summary>
        <form action={saveSectionAction}>
          <input type="hidden" name="id" value={section.id} />
          <input type="hidden" name="pageId" value={page.id} />
          <div className="admin-form-grid">
            <label>
              Type
              <select name="sectionType" defaultValue={section.sectionType}>
                {SECTION_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>
            <label>
              Ordre
              <input
                type="number"
                name="order"
                min="0"
                defaultValue={section.order}
              />
            </label>
          </div>
          <label>
            Contenu JSON
            <textarea
              name="payload"
              rows={8}
              defaultValue={JSON.stringify(section.payload, null, 2)}
            />
          </label>
          <button className="admin-table__action" disabled={disabled}>
            Mettre à jour le JSON
          </button>
        </form>
      </details>
    </div>
  );
}

function NewSectionForm({ pageId, order }: { pageId: string; order: number }) {
  return (
    <form
      action={saveSectionAction}
      className="admin-form-card cms-section-card cms-section-card--new"
    >
      <h3>Ajouter une section</h3>
      <input type="hidden" name="pageId" value={pageId} />
      <div className="admin-form-grid">
        <label>
          Type
          <select name="sectionType">
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
        <textarea
          name="payload"
          rows={8}
          defaultValue={
            '{\n  "eyebrow": "",\n  "title": "",\n  "text": "",\n  "label": "",\n  "href": "",\n  "mediaId": ""\n}'
          }
        />
      </label>
      <button className="admin-table__action" type="submit">
        Ajouter
      </button>
    </form>
  );
}
function PageWorkflow({ page }: { page: EditablePage }) {
  const transitions =
    page.lifecycle === "DRAFT"
      ? [["IN_REVIEW", "Soumettre en revue"]]
      : page.lifecycle === "IN_REVIEW"
        ? [
            ["PUBLISHED", "Publier"],
            ["DRAFT", "Renvoyer en brouillon"],
          ]
        : page.lifecycle === "PUBLISHED"
          ? [["ARCHIVED", "Archiver"]]
          : [];
  return (
    <div className="cms-workflow">
      {transitions.map(([target, label]) => (
        <form action={transitionPageAction} key={target}>
          <input type="hidden" name="id" value={page.id} />
          <input type="hidden" name="expectedVersion" value={page.version} />
          <input type="hidden" name="target" value={target} />
          <button className="admin-table__action">{label}</button>
        </form>
      ))}
    </div>
  );
}

function MediaPanel({
  worldKey,
  media,
  now,
}: {
  worldKey: string;
  media: readonly MediaAsset[];
  now: Date;
}) {
  return (
    <div className="cms-layout">
      <form
        action={uploadMediaAction}
        className="admin-form-card cms-create-card"
      >
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
        <button className="admin-table__action" type="submit">
          Envoyer vers la médiathèque
        </button>
        <p className="section__note">
          Une fois envoyée, l’image apparaît ci-contre et devient sélectionnable
          dans le champ « Image » de n’importe quelle section (Pages → Éditer →
          section HERO/MEDIA/CTA).
        </p>
      </form>
      <section className="cms-list-panel">
        <h2>Médiathèque</h2>
        {media.length === 0 ? (
          <p className="admin-empty">
            Aucun média. Les images ajoutées ici deviennent utilisables dans les
            sections des pages (hero, blocs médias…).
          </p>
        ) : (
          <div className="cms-gallery">
            {media.map((asset, index) => {
              const isRecent =
                index === 0 &&
                now.getTime() - asset.createdAt.getTime() < 5 * 60 * 1000;
              return (
                <article className="cms-gallery__tile" key={asset.id}>
                  <div className="cms-gallery__thumb">
                    {asset.mimeType.startsWith("image/") ? (
                      <img src={asset.publicUrl} alt={asset.altText} />
                    ) : (
                      <div className="cms-gallery__file">
                        {asset.mimeType.split("/")[1] ?? asset.mimeType}
                      </div>
                    )}
                    {isRecent ? (
                      <span className="cms-gallery__new-badge">Nouveau</span>
                    ) : null}
                  </div>
                  <div className="cms-gallery__caption">
                    <strong>{asset.title}</strong>
                    <details className="cms-gallery__details">
                      <summary>Détails</summary>
                      <label className="cms-gallery__url-field">
                        URL publique
                        <input
                          readOnly
                          value={asset.publicUrl}
                          onFocus={(event) => event.currentTarget.select()}
                          aria-label={`URL de ${asset.title}`}
                        />
                      </label>
                      <form action={deleteMediaAction}>
                        <input type="hidden" name="id" value={asset.id} />
                        <button className="admin-table__action">
                          Supprimer
                        </button>
                      </form>
                    </details>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
