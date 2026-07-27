/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { EditPresence } from "../_components/edit-presence";
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

import { prisma } from "@/infrastructure/shared/prisma-client";
import {
  getWorkspaceContent,
  type WorkspaceEditablePageDto,
  type WorkspaceMediaDto,
  type WorkspacePageDto,
  type WorkspaceRevisionSectionDto,
} from "@/modules/content/application/workspace-content-query";
import { PrismaWorkspaceContentReader } from "@/modules/content/infrastructure/prisma-workspace-content-query";
import { countWorkspaceEnquiries } from "@/modules/enquiries/application/workspace-enquiry-query";
import { PrismaWorkspaceEnquiryReader } from "@/modules/enquiries/infrastructure/prisma-workspace-enquiry-query";
import { parsePage, toSkipTake } from "@/shared/pagination";
import { LifecycleBadge } from "../_components/status-badge";
import { Pagination } from "../_components/pagination";
import { actorHasWorldAccess } from "../_lib/authorization";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import {
  DeleteMediaForm,
  DeleteSectionForm,
  RevisionEditor,
  SiteIdentityEditor,
  SectionFieldsForm,
  SectionJsonForm,
  UploadMediaForm,
} from "./site-content-forms";
import { MediaUrlField } from "./media-url-field";
import { PageBuilder } from "./page-builder";

const TYPED_SECTION_TYPES = new Set([
  "HERO",
  "TEXT",
  "RICH_TEXT",
  "MEDIA",
  "GALLERY",
  "FEATURE_GRID",
  "STEPS",
  "SERVICE_INDEX",
  "FAQ",
  "FORM",
  "CTA",
  "CASE_STUDY",
  "TESTIMONIAL",
  "BANNER",
  "COLUMNS",
  "STATS",
  "LOGO_CLOUD",
  "TEAM",
  "PORTFOLIO",
  "PRICING",
  "VIDEO",
  "CONTACT_INFO",
]);

const CONTENT_WORLDS = [
  { key: "pixel-digital", label: "Pixel&Digital" },
  { key: "kwaliti-print", label: "Kwaliti Print" },
] as const;

type MediaAsset = WorkspaceMediaDto;

export default async function SiteContentPage({
  searchParams,
  standalone = false,
  identityFocus = "all",
}: {
  searchParams: Promise<{
    world?: string;
    page?: string;
    tab?: string;
    listPage?: string;
  }>;
  standalone?: boolean;
  identityFocus?: "all" | "appearance" | "navigation" | "settings";
}) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");
  const now = context.clock.now();
  const params = await searchParams;
  const worldKey = params.world ?? "pixel-digital";
  const tab = params.tab ?? "overview";
  if (params.page) {
    redirect(
      `/workspace/site-content/pages/${encodeURIComponent(params.page)}/edit?world=${worldKey}`,
    );
  }
  const listPageParams = parsePage(params.listPage);
  const { skip: listSkip, take: listTake } = toSkipTake(listPageParams);

  const [contentResult, enquiryResult] = await Promise.all([
    getWorkspaceContent(
      { workspaceContentReader: new PrismaWorkspaceContentReader(prisma) },
      context,
      {
        worldKey,
        tab,
        selectedPageId: params.page,
        skip: listSkip,
        take: listTake,
      },
    ),
    tab === "overview"
      ? countWorkspaceEnquiries(
          { workspaceEnquiryReader: new PrismaWorkspaceEnquiryReader(prisma) },
          context,
          { worldKey },
        )
      : Promise.resolve(null),
  ]);
  if (!contentResult.ok) return <p role="alert">Accès refusé.</p>;
  const {
    recentPages,
    homePage,
    totalPages,
    publishedCount,
    draftCount,
    totalMedia,
    pagesForTab,
    allPagesForNavigation,
    mediaForTab,
    fullMediaForEditor,
    publishedServices,
    selectedPage,
    siteIdentity,
  } = contentResult.value;
  const enquiryCount = enquiryResult?.ok ? enquiryResult.value : null;

  const totalListPages = Math.max(
    1,
    Math.ceil(
      (tab === "media" ? totalMedia : totalPages) / listPageParams.pageSize,
    ),
  );
  const availableWorlds = CONTENT_WORLDS.filter((world) =>
    context.actor ? actorHasWorldAccess(context.actor, world.key) : false,
  );

  return (
    <>
      {!standalone ? (
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

          <nav className="admin-tabs" aria-label="Univers du contenu">
            {availableWorlds.map((world) => (
              <Link
                key={world.key}
                className={
                  world.key === worldKey
                    ? "admin-tabs__item admin-tabs__item--active"
                    : "admin-tabs__item"
                }
                href={`/workspace/site-content?world=${world.key}&tab=${tab}`}
                aria-current={world.key === worldKey ? "page" : undefined}
              >
                {world.label}
              </Link>
            ))}
          </nav>

          <div className="admin-tabs" role="tablist">
            {(
              [
                ["overview", "Vue d’ensemble"],
                ["pages", "Pages"],
                ["media", "Médiathèque"],
                ["identity", "Identité du site"],
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
        </>
      ) : null}

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
            basePath={
              standalone
                ? "/workspace/site-content/media"
                : "/workspace/site-content"
            }
            searchParams={{
              world: worldKey,
              ...(standalone ? {} : { tab: "media" }),
            }}
            page={listPageParams.page}
            totalPages={totalListPages}
            total={totalMedia}
          />
        </>
      ) : tab === "identity" ? (
        <SiteIdentityEditor
          worldKey={worldKey}
          identity={siteIdentity}
          focus={identityFocus}
          images={fullMediaForEditor.filter((asset) =>
            asset.mimeType.startsWith("image/"),
          )}
          pages={allPagesForNavigation}
        />
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
            basePath={
              standalone
                ? "/workspace/site-content/pages"
                : "/workspace/site-content"
            }
            searchParams={{
              world: worldKey,
              ...(standalone ? {} : { tab: "pages" }),
            }}
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
  recentPages: readonly WorkspacePageDto[];
  homePage: WorkspacePageDto | null;
  publishedCount: number;
  draftCount: number;
  mediaCount: number;
  publishedServices: number;
  enquiryCount: number | null;
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
          href={`/workspace/site-content/pages?world=${worldKey}`}
        />
        <GlanceCard
          tone="info"
          icon={<FileText size={20} />}
          label="Brouillons"
          value={draftCount}
          href={`/workspace/site-content/pages?world=${worldKey}`}
        />
        <GlanceCard
          tone="violet"
          icon={<ImageIcon size={20} />}
          label="Médias"
          value={mediaCount}
          href={`/workspace/site-content/media?world=${worldKey}`}
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
                      href={`/workspace/site-content/pages/${encodeURIComponent(page.id)}/edit?world=${worldKey}`}
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
                href={`/workspace/site-content/pages/new?world=${worldKey}`}
              >
                Créer ou éditer une page
              </Link>
            </li>
            <li>
              <UploadCloud size={16} />
              <Link href={`/workspace/site-content/media?world=${worldKey}`}>
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
            {enquiryCount !== null && enquiryCount > 0
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

export function PagesPanel({
  worldKey,
  pages,
}: {
  worldKey: string;
  pages: readonly WorkspacePageDto[];
}) {
  return (
    <div className="cms-pages-screen">
      <div className="cms-screen-heading">
        <div>
          <span>Contenu</span>
          <h2>Pages</h2>
          <p>Créez, organisez et publiez les pages des deux sites.</p>
        </div>
        <Link
          className="button button--primary"
          href={`/workspace/site-content/pages/new?world=${worldKey}`}
        >
          <PlusCircle size={16} /> Nouvelle page
        </Link>
      </div>
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
                  <th>Route</th>
                  <th>Source</th>
                  <th>Cycle</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page.id}>
                    <td>{page.title}</td>
                    <td>{page.routePath ?? `/${page.slug}`}</td>
                    <td>
                      {page.serviceId
                        ? "Service"
                        : page.pageKind === "SYSTEM"
                          ? "Système"
                          : "Page CMS"}
                    </td>
                    <td>
                      <LifecycleBadge lifecycle={page.lifecycle} />
                      {page.draftRevisionId &&
                      page.lifecycle === "PUBLISHED" ? (
                        <span className="admin-table__note">
                          {" "}
                          · brouillon en cours
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <Link
                        className="admin-table__action"
                        href={`/workspace/site-content/pages/${encodeURIComponent(page.id)}/edit?world=${worldKey}`}
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

type EditablePage = WorkspaceEditablePageDto;

export function PageEditor({
  worldKey,
  page,
  media,
}: {
  worldKey: string;
  page: EditablePage;
  media: readonly MediaAsset[];
}) {
  const activeRevision = page.draftRevision ?? page.publishedRevision;
  const sections = activeRevision?.sections ?? page.sections;
  const editable = page.draftRevision?.status === "DRAFT";
  const publicPath =
    page.routePath ??
    `${page.worldKey === "kwaliti-print" ? "/kwaliti-print" : ""}/${page.slug}`;
  const previewUrl = page.draftRevision
    ? `${publicPath}?preview=${page.draftRevision.id}&visualEditor=1`
    : `${publicPath}?visualEditor=1`;
  return (
    <div className="cms-editor cms-editor--visual">
      <EditPresence entityType="PAGE" entityId={page.id} />
      <div className="cms-visual-editor-bar">
        <div>
          <Link href={`/workspace/site-content/pages?world=${worldKey}`}>
            ← Pages
          </Link>
          <span className="cms-visual-editor-bar__divider" />
          <strong>{activeRevision?.title ?? page.title}</strong>
          <LifecycleBadge lifecycle={page.lifecycle} />
        </div>
        {previewUrl ? (
          <a href={previewUrl} target="_blank" rel="noreferrer">
            Ouvrir l’aperçu
          </a>
        ) : null}
      </div>
      <PageBuilder
        key={`${activeRevision?.id ?? "legacy"}-${activeRevision?.version ?? 0}`}
        pageId={page.id}
        revisionId={page.draftRevision?.id ?? null}
        revisionVersion={page.draftRevision?.version ?? null}
        sectionIds={sections.map((section) => section.id)}
        sectionTypes={sections.map((section) => section.sectionType)}
        sectionVersions={sections.map((section) => section.version)}
        sectionMediaIds={sections.map((section) => {
          const payload = section.payload as Record<string, unknown>;
          return typeof payload.mediaId === "string" ? payload.mediaId : "";
        })}
        sectionGalleryMediaIds={sections.map((section) => {
          const payload = section.payload as Record<string, unknown>;
          return Array.isArray(payload.mediaIds)
            ? payload.mediaIds.filter(
                (id): id is string => typeof id === "string",
              )
            : [];
        })}
        mediaAssets={media}
        editable={editable}
        previewUrl={previewUrl}
        settings={
          <RevisionEditor
            pageId={page.id}
            draft={page.draftRevision}
            published={page.publishedRevision}
          />
        }
      >
        {sections.map((section) => (
          <SectionEditor
            key={section.id}
            page={page}
            section={section}
            media={media}
            revisionId={page.draftRevision?.id ?? null}
            editable={editable}
          />
        ))}
      </PageBuilder>
    </div>
  );
}

function SectionEditor({
  page,
  section,
  media,
  revisionId,
  editable,
}: {
  page: EditablePage;
  section: EditablePage["sections"][number] | WorkspaceRevisionSectionDto;
  media: readonly MediaAsset[];
  revisionId: string | null;
  editable: boolean;
}) {
  const payload = section.payload as Record<string, unknown>;
  const value = (key: string) =>
    typeof payload[key] === "string" ? (payload[key] as string) : "";
  const disabled = !editable || !revisionId;
  const typed = TYPED_SECTION_TYPES.has(section.sectionType);
  const images = media.filter((asset) => asset.mimeType.startsWith("image/"));

  return (
    <div className="admin-form-card cms-section-card">
      <header className="cms-section-card__head">
        <h3>
          {section.sectionType} · position {section.order}
        </h3>
        {!disabled && revisionId ? (
          <DeleteSectionForm
            sectionId={section.id}
            pageId={page.id}
            revisionId={revisionId}
          />
        ) : null}
      </header>

      {typed && !disabled ? (
        <SectionFieldsForm
          sectionId={section.id}
          version={section.version}
          pageId={page.id}
          revisionId={revisionId ?? ""}
          sectionType={section.sectionType}
          order={section.order}
          eyebrow={value("eyebrow")}
          title={value("title")}
          text={value("text")}
          label={value("label")}
          href={value("href")}
          mediaId={value("mediaId")}
          images={images}
          worldKey={page.worldKey}
          editable={!disabled}
          evidencePayload={payload}
        />
      ) : (
        <div className="cms-builder__summary">
          <strong>
            {value("title") || value("quote") || "Bloc sans titre"}
          </strong>
          {value("text") ? <p>{value("text")}</p> : null}
        </div>
      )}

      {!disabled ? (
        <details className="admin-user-card__details">
          <summary>{typed ? "Mode avancé (JSON)" : "Contenu (JSON)"}</summary>
          <SectionJsonForm
            sectionId={section.id}
            version={section.version}
            pageId={page.id}
            revisionId={revisionId ?? ""}
            sectionType={section.sectionType}
            order={section.order}
            payload={JSON.stringify(section.payload, null, 2)}
            editable={!disabled}
          />
        </details>
      ) : null}
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
      <UploadMediaForm worldKey={worldKey} />
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
                      <MediaUrlField
                        title={asset.title}
                        publicUrl={asset.publicUrl}
                      />
                      <DeleteMediaForm mediaId={asset.id} />
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
