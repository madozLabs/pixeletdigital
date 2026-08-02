/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { CommentThread } from "../_components/comment-thread";
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
import { comparePageRevisionSections } from "@/modules/content/domain/page-revision-diff";
import { validatePageBlock } from "@/modules/content/domain/page-block-registry";
import { countWorkspaceEnquiries } from "@/modules/enquiries/application/workspace-enquiry-query";
import { PrismaWorkspaceEnquiryReader } from "@/modules/enquiries/infrastructure/prisma-workspace-enquiry-query";
import { parsePage, toSkipTake } from "@/shared/pagination";
import { LifecycleBadge } from "../_components/status-badge";
import { Pagination } from "../_components/pagination";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import {
  DeleteMediaForm,
  DeleteSectionForm,
  DuplicatePageForm,
  EditMediaDetailsForm,
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
    q?: string;
    status?: string;
    type?: string;
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
  const search = params.q?.trim() || undefined;
  const pageStatus = tab === "pages" ? params.status || undefined : undefined;
  const mediaType = tab === "media" ? params.type || undefined : undefined;

  const [contentResult, enquiryResult, commentUsers] = await Promise.all([
    getWorkspaceContent(
      { workspaceContentReader: new PrismaWorkspaceContentReader(prisma) },
      context,
      {
        worldKey,
        tab,
        selectedPageId: params.page,
        skip: listSkip,
        take: listTake,
        pageSearch: tab === "pages" ? search : undefined,
        pageStatus,
        mediaSearch: tab === "media" ? search : undefined,
        mediaType,
      },
    ),
    tab === "overview"
      ? countWorkspaceEnquiries(
          { workspaceEnquiryReader: new PrismaWorkspaceEnquiryReader(prisma) },
          context,
          { worldKey },
        )
      : Promise.resolve(null),
    params.page
      ? prisma.user.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, displayName: true, normalizedEmail: true },
          orderBy: { displayName: "asc" },
        })
      : Promise.resolve([]),
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
    revisionAuthors,
  } = contentResult.value;
  const enquiryCount = enquiryResult?.ok ? enquiryResult.value : null;

  const totalListPages = Math.max(
    1,
    Math.ceil(
      (tab === "media" ? totalMedia : totalPages) / listPageParams.pageSize,
    ),
  );
  return (
    <>
      {!standalone ? (
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
          <MediaPanel
            worldKey={worldKey}
            media={mediaForTab}
            now={now}
            search={params.q ?? ""}
            mediaType={params.type ?? ""}
          />
          <Pagination
            basePath={
              standalone
                ? "/workspace/site-content/media"
                : "/workspace/site-content"
            }
            searchParams={{
              world: worldKey,
              ...(standalone ? {} : { tab: "media" }),
              ...(params.q ? { q: params.q } : {}),
              ...(params.type ? { type: params.type } : {}),
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
          pages={allPagesForNavigation}
          revisionAuthors={revisionAuthors}
          currentUserId={context.actor?.id ?? ""}
          users={commentUsers.map((user) => ({
            id: user.id,
            name: user.displayName ?? user.normalizedEmail ?? "Collaborateur",
          }))}
        />
      ) : (
        <>
          <PagesPanel
            worldKey={worldKey}
            pages={pagesForTab}
            search={params.q ?? ""}
            status={params.status ?? ""}
          />
          <Pagination
            basePath={
              standalone
                ? "/workspace/site-content/pages"
                : "/workspace/site-content"
            }
            searchParams={{
              world: worldKey,
              ...(standalone ? {} : { tab: "pages" }),
              ...(params.q ? { q: params.q } : {}),
              ...(params.status ? { status: params.status } : {}),
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
  search = "",
  status = "",
}: {
  worldKey: string;
  pages: readonly WorkspacePageDto[];
  search?: string;
  status?: string;
}) {
  const hasFilters = Boolean(search || status);
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
      <form className="admin-form-card cms-list-filters" method="get">
        <input type="hidden" name="world" value={worldKey} />
        <label>
          Recherche
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Titre, slug ou route…"
          />
        </label>
        <label>
          Statut
          <select name="status" defaultValue={status}>
            <option value="">Tous</option>
            <option value="DRAFT">Brouillon</option>
            <option value="IN_REVIEW">En revue</option>
            <option value="SCHEDULED">Programmée</option>
            <option value="PUBLISHED">Publiée</option>
            <option value="ARCHIVED">Archivée</option>
          </select>
        </label>
        <button className="admin-table__action" type="submit">
          Filtrer
        </button>
        {hasFilters ? (
          <Link
            className="admin-table__action"
            href={`/workspace/site-content/pages?world=${worldKey}`}
          >
            Réinitialiser
          </Link>
        ) : null}
      </form>
      <section className="cms-list-panel">
        <h2>Pages de l’univers</h2>
        {pages.length === 0 ? (
          <p className="admin-empty">
            {hasFilters
              ? "Aucune page ne correspond à cette recherche."
              : "Aucune page."}
          </p>
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
                    <td className="admin-table__actions">
                      <Link
                        className="admin-table__action"
                        href={`/workspace/site-content/pages/${encodeURIComponent(page.id)}/edit?world=${worldKey}`}
                      >
                        Éditer
                      </Link>
                      {page.pageKind !== "SYSTEM" && !page.serviceId ? (
                        <DuplicatePageForm
                          pageId={page.id}
                          worldKey={worldKey}
                        />
                      ) : null}
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
  pages,
  revisionAuthors,
  currentUserId,
  users,
}: {
  worldKey: string;
  page: EditablePage;
  media: readonly MediaAsset[];
  pages: readonly WorkspacePageDto[];
  revisionAuthors: Readonly<Record<string, string>>;
  currentUserId: string;
  users: readonly Readonly<{ id: string; name: string }>[];
}) {
  const activeRevision = page.draftRevision ?? page.publishedRevision;
  const sections = activeRevision?.sections ?? [];
  const editable = page.draftRevision?.status === "DRAFT";
  const publicPath =
    page.routePath ??
    `${page.worldKey === "kwaliti-print" ? "/kwaliti-print" : ""}/${page.slug}`;
  const previewUrl = page.draftRevision
    ? `${publicPath}?preview=${page.draftRevision.id}&visualEditor=1`
    : `${publicPath}?visualEditor=1`;
  const publishedPreviewUrl = page.publishedRevision
    ? `${publicPath}?visualEditor=1`
    : null;
  const changeSummary = page.draftRevision
    ? comparePageRevisionSections(
        page.publishedRevision?.sections ?? [],
        page.draftRevision.sections,
      )
    : null;
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
          {currentUserId ? (
            <CommentThread
              entityType="PAGE"
              entityId={page.id}
              currentUserId={currentUserId}
              users={users}
              revalidatePathHint={`/workspace/site-content/pages/${page.id}/edit`}
            />
          ) : null}
        </div>
        {previewUrl ? (
          <a href={previewUrl} target="_blank" rel="noreferrer">
            Ouvrir l’aperçu
          </a>
        ) : null}
      </div>
      <PageBuilder
        key={`${activeRevision?.id ?? "empty"}-${activeRevision?.version ?? 0}`}
        pageId={page.id}
        revisionId={page.draftRevision?.id ?? null}
        revisionVersion={page.draftRevision?.version ?? null}
        sectionIds={sections.map((section) => section.id)}
        sectionTypes={sections.map((section) => section.sectionType)}
        sectionLabels={sections.map((section) => {
          const payload = section.payload as Record<string, unknown>;
          const title = [payload.title, payload.heading, payload.name].find(
            (value): value is string =>
              typeof value === "string" && value.trim().length > 0,
          );
          return title?.trim() ?? section.sectionType;
        })}
        sectionErrors={sections.map((section) =>
          validatePageBlock(
            section.sectionType,
            section.payload as Record<string, unknown>,
          ),
        )}
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
        publishedPreviewUrl={publishedPreviewUrl}
        targetPages={pages.filter(
          (candidate) => candidate.id !== page.id && candidate.draftRevisionId,
        )}
        settings={
          <RevisionEditor
            pageId={page.id}
            draft={page.draftRevision}
            published={page.publishedRevision}
            history={page.revisionHistory}
            changeSummary={changeSummary}
            authors={revisionAuthors}
            images={media.filter((asset) =>
              asset.mimeType.startsWith("image/"),
            )}
            publicPath={publicPath}
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
  section: WorkspaceRevisionSectionDto;
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
  search = "",
  mediaType = "",
}: {
  worldKey: string;
  media: readonly MediaAsset[];
  now: Date;
  search?: string;
  mediaType?: string;
}) {
  const hasFilters = Boolean(search || mediaType);
  return (
    <div className="cms-layout">
      <UploadMediaForm worldKey={worldKey} />
      <form className="admin-form-card cms-list-filters" method="get">
        <input type="hidden" name="world" value={worldKey} />
        <label>
          Recherche
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Titre, alt ou tag…"
          />
        </label>
        <label>
          Type
          <select name="type" defaultValue={mediaType}>
            <option value="">Tous</option>
            <option value="image">Images</option>
            <option value="video">Vidéos</option>
            <option value="other">Autres fichiers</option>
          </select>
        </label>
        <button className="admin-table__action" type="submit">
          Filtrer
        </button>
        {hasFilters ? (
          <Link
            className="admin-table__action"
            href={`/workspace/site-content/media?world=${worldKey}`}
          >
            Réinitialiser
          </Link>
        ) : null}
      </form>
      <section className="cms-list-panel">
        <h2>Médiathèque</h2>
        {media.length === 0 ? (
          <p className="admin-empty">
            {hasFilters
              ? "Aucun média ne correspond à cette recherche."
              : "Aucun média. Les images ajoutées ici deviennent utilisables dans les sections des pages (hero, blocs médias…)."}
          </p>
        ) : (
          <div className="cms-gallery">
            {media.map((asset, index) => {
              const isRecent =
                index === 0 &&
                now.getTime() - asset.createdAt.getTime() < 5 * 60 * 1000;
              const daysToExpiry = asset.rightsExpiresAt
                ? Math.ceil(
                    (asset.rightsExpiresAt.getTime() - now.getTime()) /
                      (24 * 60 * 60 * 1000),
                  )
                : null;
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
                    {asset.tags.length > 0 ? (
                      <span className="cms-gallery__tags">
                        {asset.tags.map((tag) => (
                          <span key={tag} className="cms-gallery__tag">
                            {tag}
                          </span>
                        ))}
                      </span>
                    ) : null}
                    {daysToExpiry !== null ? (
                      <p
                        className={
                          daysToExpiry < 0
                            ? "cms-gallery__rights cms-gallery__rights--expired"
                            : daysToExpiry <= 30
                              ? "cms-gallery__rights cms-gallery__rights--warning"
                              : "cms-gallery__rights"
                        }
                      >
                        {daysToExpiry < 0
                          ? "Droits d’usage expirés"
                          : `Droits d’usage jusqu’au ${asset.rightsExpiresAt?.toLocaleDateString("fr-FR")}`}
                      </p>
                    ) : null}
                    <details className="cms-gallery__details">
                      <summary>Détails</summary>
                      <MediaUrlField
                        title={asset.title}
                        publicUrl={asset.publicUrl}
                      />
                      <EditMediaDetailsForm
                        mediaId={asset.id}
                        title={asset.title}
                        altText={asset.altText}
                        caption={asset.caption ?? ""}
                        credit={asset.credit ?? ""}
                        rightsStatement={asset.rightsStatement ?? ""}
                        rightsExpiresAt={
                          asset.rightsExpiresAt
                            ? asset.rightsExpiresAt.toISOString().slice(0, 10)
                            : ""
                        }
                        tags={asset.tags.join(", ")}
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
