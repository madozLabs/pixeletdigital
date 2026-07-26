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
  CreatePageForm,
  DeleteMediaForm,
  DeleteSectionForm,
  PageTransitionForm,
  SectionFieldsForm,
  SectionJsonForm,
  UpdatePageForm,
  UploadMediaForm,
} from "./site-content-forms";
import { MediaUrlField } from "./media-url-field";

const TYPED_SECTION_TYPES = new Set([
  "HERO",
  "TEXT",
  "MEDIA",
  "CTA",
  "CASE_STUDY",
  "TESTIMONIAL",
]);

const CONTENT_WORLDS = [
  { key: "pixel-digital", label: "Pixel&Digital" },
  { key: "kwaliti-print", label: "Kwaliti Print" },
] as const;

type MediaAsset = WorkspaceMediaDto;

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
    countWorkspaceEnquiries(
      { workspaceEnquiryReader: new PrismaWorkspaceEnquiryReader(prisma) },
      context,
      { worldKey },
    ),
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
    mediaForTab,
    fullMediaForEditor,
    publishedServices,
    selectedPage,
  } = contentResult.value;
  const enquiryCount = enquiryResult.ok ? enquiryResult.value : 0;

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
  recentPages: readonly WorkspacePageDto[];
  homePage: WorkspacePageDto | null;
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
  pages: readonly WorkspacePageDto[];
}) {
  return (
    <div className="cms-layout">
      <CreatePageForm worldKey={worldKey} />
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

type EditablePage = WorkspaceEditablePageDto;

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
      <EditPresence entityType="PAGE" entityId={page.id} />
      <div className="cms-editor__top">
        <Link href={`/workspace/site-content?world=${worldKey}&tab=pages`}>
          ← Toutes les pages
        </Link>
        <LifecycleBadge lifecycle={page.lifecycle} />
      </div>
      <UpdatePageForm
        id={page.id}
        version={page.version}
        title={page.title}
        slug={page.slug}
        editable={page.lifecycle === "DRAFT"}
      />
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
        {!disabled ? <DeleteSectionForm sectionId={section.id} /> : null}
      </header>

      {typed ? (
        <SectionFieldsForm
          sectionId={section.id}
          version={section.version}
          pageId={page.id}
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
      ) : null}

      <details className="admin-user-card__details">
        <summary>{typed ? "Mode avancé (JSON)" : "Contenu (JSON)"}</summary>
        <SectionJsonForm
          sectionId={section.id}
          version={section.version}
          pageId={page.id}
          sectionType={section.sectionType}
          order={section.order}
          payload={JSON.stringify(section.payload, null, 2)}
          editable={!disabled}
        />
      </details>
    </div>
  );
}

function NewSectionForm({ pageId, order }: { pageId: string; order: number }) {
  return (
    <SectionJsonForm
      pageId={pageId}
      order={order}
      payload='{\n  "eyebrow": "",\n  "title": "",\n  "text": "",\n  "label": "",\n  "href": "",\n  "mediaId": ""\n}'
      editable
    />
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
        <PageTransitionForm
          key={target}
          id={page.id}
          version={page.version}
          target={target}
          label={label}
        />
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
