/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { redirect } from "next/navigation";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/infrastructure/shared/prisma-client";
import { LifecycleBadge } from "../_components/status-badge";
import { getWorkspaceRequestContext } from "../get-workspace-context";
import {
  createPageAction,
  deleteMediaAction,
  deleteSectionAction,
  saveSectionAction,
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

export default async function SiteContentPage({
  searchParams,
}: {
  searchParams: Promise<{ world?: string; page?: string; tab?: string }>;
}) {
  const context = await getWorkspaceRequestContext();
  if (!context) redirect("/login");
  const params = await searchParams;
  const worldKey = params.world ?? "pixel-digital";
  const tab = params.tab ?? "pages";
  const [pages, media] = await Promise.all([
    prisma.page
      .findMany({ where: { worldKey }, orderBy: { updatedAt: "desc" } })
      .catch(() => []),
    prisma.mediaAsset
      .findMany({ where: { worldKey }, orderBy: { createdAt: "desc" } })
      .catch(() => []),
  ]);
  const selectedPage = params.page
    ? await prisma.page
        .findUnique({
          where: { id: params.page },
          include: { sections: { orderBy: { order: "asc" } } },
        })
        .catch(() => null)
    : null;
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1 className="admin-content__title">Site &amp; contenus</h1>
          <p className="admin-content__lede">
            Gérez les pages, leurs sections et la médiathèque Supabase.
          </p>
        </div>
        <span className="admin-metric">{pages.length} pages</span>
      </div>

      <div className="admin-tabs" role="tablist">
        <Link
          className={
            tab === "pages"
              ? "admin-tabs__item admin-tabs__item--active"
              : "admin-tabs__item"
          }
          href={`/workspace/site-content?world=${worldKey}&tab=pages`}
        >
          Pages <span className="admin-tabs__count">{pages.length}</span>
        </Link>
        <Link
          className={
            tab === "media"
              ? "admin-tabs__item admin-tabs__item--active"
              : "admin-tabs__item"
          }
          href={`/workspace/site-content?world=${worldKey}&tab=media`}
        >
          Médiathèque <span className="admin-tabs__count">{media.length}</span>
        </Link>
      </div>

      {tab === "media" ? (
        <MediaPanel worldKey={worldKey} media={media} />
      ) : selectedPage ? (
        <PageEditor worldKey={worldKey} page={selectedPage} />
      ) : (
        <PagesPanel worldKey={worldKey} pages={pages} />
      )}
    </>
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
                  <th>Sections</th>
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
                    <td>—</td>
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
}: {
  worldKey: string;
  page: EditablePage;
}) {
  return (
    <div className="cms-editor">
      <div className="cms-editor__top">
        <Link href={`/workspace/site-content?world=${worldKey}`}>
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
          <form
            action={saveSectionAction}
            className="admin-form-card cms-section-card"
            key={section.id}
          >
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
            <div className="admin-table__actions">
              <button
                className="admin-table__action"
                disabled={page.lifecycle !== "DRAFT"}
              >
                Mettre à jour
              </button>
            </div>
          </form>
        ))}
        {page.lifecycle === "DRAFT" ? (
          <NewSectionForm pageId={page.id} order={page.sections.length} />
        ) : null}
      </div>
      {page.lifecycle === "DRAFT" && page.sections.length > 0 ? (
        <div className="cms-delete-list">
          {page.sections.map((section) => (
            <form action={deleteSectionAction} key={section.id}>
              <input type="hidden" name="id" value={section.id} />
              <button className="admin-table__action" type="submit">
                Supprimer {section.sectionType} #{section.order}
              </button>
            </form>
          ))}
        </div>
      ) : null}
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
            '{\n  "eyebrow": "",\n  "title": "",\n  "text": "",\n  "mediaId": null\n}'
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
}: {
  worldKey: string;
  media: Awaited<ReturnType<typeof prisma.mediaAsset.findMany>>;
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
          Envoyer vers Supabase
        </button>
        <p className="section__note">
          Variables requises : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.
        </p>
      </form>
      <section className="cms-list-panel">
        <h2>Médiathèque</h2>
        <div className="cms-media-grid">
          {media.map((asset) => (
            <article className="cms-media-card" key={asset.id}>
              {asset.mimeType.startsWith("image/") ? (
                <img src={asset.publicUrl} alt={asset.altText} />
              ) : (
                <div className="cms-media-card__file">{asset.mimeType}</div>
              )}
              <div>
                <strong>{asset.title}</strong>
                <p>{asset.altText}</p>
                <code>{asset.objectPath}</code>
              </div>
              <form action={deleteMediaAction}>
                <input type="hidden" name="id" value={asset.id} />
                <button className="admin-table__action">Supprimer</button>
              </form>
            </article>
          ))}
        </div>
        {media.length === 0 ? (
          <p className="admin-empty">Aucun média enregistré.</p>
        ) : null}
      </section>
    </div>
  );
}
