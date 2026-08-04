import Image from "next/image";
import Link from "next/link";

import {
  isEvidencePublishable,
  isEvidenceSectionType,
} from "@/modules/content/domain/evidence-section";
import {
  clampColumnCount,
  getPageBlockDefinition,
  isNestableBlockType,
  type NestedBlock,
} from "@/modules/content/domain/page-block-registry";

import { EvidenceSection } from "./evidence-section";
import { CmsTabs } from "./cms-tabs";
import {
  CmsPrimaryImageOverlay,
  CmsSectionBackground,
  cmsSectionDesignProps,
} from "./cms-section-design";

export type CmsMediaAsset = Readonly<{
  id: string;
  publicUrl: string;
  altText: string;
  mimeType: string;
}>;

export type CmsPublicService = Readonly<{
  slug: string;
  name: string;
  description: string;
}>;

// The "PAGES" source of a SERVICE_INDEX ("Collection dynamique") block --
// any published page, filtered by pageType, e.g. every PORTFOLIO page.
// The caller fetches the union of pages needed by every such block on the
// page (see resolveCollectionPages in [slug]/page.tsx); pageType lets this
// component do the final per-block filter + limit itself, since multiple
// blocks on the same page can each want a different slice of that union.
export type CmsPublicPageSummary = Readonly<{
  slug: string;
  routePath: string | null;
  pageType: string;
  title: string;
  description: string;
}>;

export function CmsSection({
  sectionId,
  type,
  payload,
  mediaById,
  services,
  pages = [],
  worldKey,
  editing = false,
}: Readonly<{
  sectionId: string;
  type: string;
  payload: Record<string, unknown>;
  mediaById: ReadonlyMap<string, CmsMediaAsset>;
  services: readonly CmsPublicService[];
  pages?: readonly CmsPublicPageSummary[];
  worldKey: "pixel-digital" | "kwaliti-print";
  editing?: boolean;
}>) {
  const title = stringValue(payload, "title");
  const text = stringValue(payload, "text");
  const eyebrow = stringValue(payload, "eyebrow");
  const href = stringValue(payload, "href") || "/contact";
  const label = stringValue(payload, "label") || "Lancer un projet";
  const mediaId = stringValue(payload, "mediaId");
  const asset = mediaId ? mediaById.get(mediaId) : null;
  const items = objectItems(payload.items);
  const sectionProps = {
    "data-cms-section-id": sectionId,
    "data-cms-section-type": type,
  };
  const definition = getPageBlockDefinition(type);
  const blockLabel = definition?.label ?? type;

  if (isEvidenceSectionType(type)) {
    if (editing && !isEvidencePublishable(type, payload)) {
      return (
        <EditorPlaceholder
          sectionId={sectionId}
          type={type}
          label={blockLabel}
          message="Complétez et validez la preuve pour afficher ce bloc."
        />
      );
    }
    return (
      <EvidenceSection
        type={type}
        payload={payload}
        media={asset}
        mediaById={mediaById}
        sectionId={sectionId}
      />
    );
  }

  if (type === "HERO") {
    return (
      <section
        {...cmsSectionDesignProps(payload, "cms-public-hero")}
        {...sectionProps}
      >
        <CmsSectionBackground
          payload={payload}
          mediaById={mediaById}
          priority
        />
        <div>
          <EditableCopy
            as="p"
            field="eyebrow"
            value={eyebrow}
            editing={editing}
          />
          <EditableCopy as="h1" field="title" value={title} editing={editing} />
          <EditableCopy as="p" field="text" value={text} editing={editing} />
          <Link className="button button--primary" href={href}>
            {label}
          </Link>
        </div>
        {asset?.mimeType.startsWith("image/") ? (
          <div
            className="cms-public-image cms-public-image--hero"
            data-cms-media-slot="primary"
          >
            <Image
              src={asset.publicUrl}
              alt={asset.altText}
              fill
              priority
              sizes="(max-width: 760px) 100vw, 45vw"
            />
            <CmsPrimaryImageOverlay />
          </div>
        ) : editing ? (
          <MediaPlaceholder />
        ) : null}
      </section>
    );
  }

  if (type === "MEDIA") {
    return (
      <section
        {...cmsSectionDesignProps(
          payload,
          "cms-public-section cms-public-media",
        )}
        {...sectionProps}
      >
        <CmsSectionBackground payload={payload} mediaById={mediaById} />
        {asset?.mimeType.startsWith("image/") ? (
          <div className="cms-public-image" data-cms-media-slot="primary">
            <Image
              src={asset.publicUrl}
              alt={asset.altText}
              fill
              sizes="(max-width: 760px) 100vw, 50vw"
            />
            <CmsPrimaryImageOverlay />
          </div>
        ) : editing ? (
          <MediaPlaceholder />
        ) : null}
        <div>
          <EditableCopy
            as="p"
            field="eyebrow"
            value={eyebrow}
            editing={editing}
          />
          <EditableCopy as="h2" field="title" value={title} editing={editing} />
          <EditableCopy as="p" field="text" value={text} editing={editing} />
        </div>
      </section>
    );
  }

  if (type === "CTA" || type === "BANNER") {
    return (
      <section
        {...cmsSectionDesignProps(payload, "cms-public-cta")}
        {...sectionProps}
      >
        <CmsSectionBackground payload={payload} mediaById={mediaById} />
        <EditableCopy as="h2" field="title" value={title} editing={editing} />
        <EditableCopy as="p" field="text" value={text} editing={editing} />
        <Link className="button button--primary" href={href}>
          {label}
        </Link>
      </section>
    );
  }

  if (
    type === "GALLERY" ||
    type === "LOGO_CLOUD" ||
    type === "PORTFOLIO" ||
    type === "CAROUSEL"
  ) {
    const gallery = stringItems(payload.mediaIds)
      .map((id) => mediaById.get(id))
      .filter((item): item is CmsMediaAsset =>
        Boolean(item?.mimeType.startsWith("image/")),
      );
    return (
      <section
        {...cmsSectionDesignProps(
          payload,
          `cms-public-section cms-public-gallery cms-public-gallery--${type.toLowerCase()}`,
        )}
        {...sectionProps}
      >
        <CmsSectionBackground payload={payload} mediaById={mediaById} />
        <EditableCopy
          as="p"
          field="eyebrow"
          value={eyebrow}
          editing={editing}
        />
        <EditableCopy as="h2" field="title" value={title} editing={editing} />
        <EditableCopy as="p" field="text" value={text} editing={editing} />
        <div className="cms-public-gallery__grid" data-cms-media-slot="gallery">
          {gallery.map((image) => (
            <figure key={image.id} className="cms-public-gallery__item">
              <Image
                src={image.publicUrl}
                alt={image.altText}
                fill
                sizes="(max-width: 700px) 100vw, 33vw"
              />
              <CmsPrimaryImageOverlay />
            </figure>
          ))}
          {editing && gallery.length === 0 ? (
            <div className="cms-editor-media-placeholder">
              <strong>Choisir des images</strong>
              <span>Cliquez ici pour ouvrir la médiathèque.</span>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (type === "FAQ" || type === "ACCORDION") {
    return (
      <section
        {...cmsSectionDesignProps(
          payload,
          `cms-public-section cms-public-faq${type === "ACCORDION" ? " cms-public-accordion" : ""}`,
        )}
        {...sectionProps}
      >
        <CmsSectionBackground payload={payload} mediaById={mediaById} />
        <EditableCopy as="h2" field="title" value={title} editing={editing} />
        {items.map((item, index) => (
          <details
            key={`${String(item.title)}-${index}`}
            open={editing || undefined}
          >
            <summary data-cms-item-index={index} data-cms-item-field="title">
              {String(item.title ?? (type === "FAQ" ? "Question" : "Section"))}
            </summary>
            <p data-cms-item-index={index} data-cms-item-field="text">
              {String(item.text ?? "")}
            </p>
          </details>
        ))}
        {editing && items.length === 0 ? <ItemsPlaceholder /> : null}
      </section>
    );
  }

  if (type === "COLUMNS") {
    const columnCount = clampColumnCount(payload.columnCount);
    const columns = nestedColumns(payload.columns).slice(0, columnCount);
    return (
      <section
        {...cmsSectionDesignProps(
          payload,
          "cms-public-section cms-public-columns",
        )}
        {...sectionProps}
      >
        <CmsSectionBackground payload={payload} mediaById={mediaById} />
        <EditableCopy
          as="p"
          field="eyebrow"
          value={eyebrow}
          editing={editing}
        />
        <EditableCopy as="h2" field="title" value={title} editing={editing} />
        <EditableCopy as="p" field="text" value={text} editing={editing} />
        <div
          className="cms-public-columns__grid"
          style={
            { "--cms-columns-count": columnCount } as React.CSSProperties
          }
        >
          {Array.from({ length: columnCount }, (_, index) => (
            <div className="cms-public-columns__column" key={index}>
              {(columns[index] ?? []).map((nested) => (
                <CmsSection
                  key={nested.id}
                  sectionId={nested.id}
                  type={nested.type}
                  payload={nested.payload}
                  mediaById={mediaById}
                  services={services}
                  worldKey={worldKey}
                  editing={false}
                />
              ))}
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (
    type === "FEATURE_GRID" ||
    type === "STEPS" ||
    type === "STATS" ||
    type === "TEAM" ||
    type === "PRICING" ||
    type === "CONTACT_INFO"
  ) {
    return (
      <section
        {...cmsSectionDesignProps(
          payload,
          `cms-public-section cms-public-items cms-public-items--${type.toLowerCase()}`,
        )}
        {...sectionProps}
      >
        <CmsSectionBackground payload={payload} mediaById={mediaById} />
        <EditableCopy
          as="p"
          field="eyebrow"
          value={eyebrow}
          editing={editing}
        />
        <EditableCopy as="h2" field="title" value={title} editing={editing} />
        <EditableCopy as="p" field="text" value={text} editing={editing} />
        <div className="cms-public-items__grid">
          {items.map((item, index) => (
            <article key={`${String(item.title)}-${index}`}>
              {type === "STEPS" ? (
                <span>{String(index + 1).padStart(2, "0")}</span>
              ) : null}
              <h3 data-cms-item-index={index} data-cms-item-field="title">
                {String(item.title ?? "")}
              </h3>
              <p data-cms-item-index={index} data-cms-item-field="text">
                {String(item.text ?? "")}
              </p>
            </article>
          ))}
          {editing && items.length === 0 ? <ItemsPlaceholder /> : null}
        </div>
      </section>
    );
  }

  if (type === "SERVICE_INDEX") {
    const source = stringValue(payload, "source") || "SERVICES";
    const pageTypeFilter = stringValue(payload, "pageTypeFilter");
    const limitRaw = Number(stringValue(payload, "limit"));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 12;
    const collectionItems =
      source === "PAGES"
        ? pages
            .filter(
              (page) => !pageTypeFilter || page.pageType === pageTypeFilter,
            )
            .slice(0, limit)
            .map((page) => ({
              key: page.slug,
              href: page.routePath ?? `/${page.slug}`,
              name: page.title,
              description: page.description,
            }))
        : services.map((service) => ({
            key: service.slug,
            href:
              worldKey === "kwaliti-print"
                ? `/kwaliti-print/${service.slug}`
                : `/services/${service.slug}`,
            name: service.name,
            description: service.description,
          }));
    return (
      <section
        {...cmsSectionDesignProps(
          payload,
          "cms-public-section cms-public-items",
        )}
        {...sectionProps}
      >
        <CmsSectionBackground payload={payload} mediaById={mediaById} />
        <EditableCopy
          as="p"
          field="eyebrow"
          value={eyebrow}
          editing={editing}
        />
        <EditableCopy as="h2" field="title" value={title} editing={editing} />
        <div className="cms-public-items__grid">
          {collectionItems.map((item) => (
            <article key={item.key}>
              <h3>
                <Link href={item.href}>{item.name}</Link>
              </h3>
              <p>{item.description}</p>
            </article>
          ))}
          {editing && collectionItems.length === 0 ? (
            <div className="cms-editor-placeholder">
              {source === "PAGES"
                ? "Aucune page publiée ne correspond à ce filtre."
                : "Aucun service publié."}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (type === "FORM") {
    return (
      <section
        {...cmsSectionDesignProps(payload, "cms-public-cta")}
        {...sectionProps}
      >
        <CmsSectionBackground payload={payload} mediaById={mediaById} />
        <EditableCopy as="h2" field="title" value={title} editing={editing} />
        <EditableCopy as="p" field="text" value={text} editing={editing} />
        <Link className="button button--primary" href="/contact">
          Ouvrir le formulaire
        </Link>
      </section>
    );
  }

  if (type === "VIDEO") {
    return (
      <section
        {...cmsSectionDesignProps(
          payload,
          "cms-public-section cms-public-media",
        )}
        {...sectionProps}
      >
        <CmsSectionBackground payload={payload} mediaById={mediaById} />
        {asset?.mimeType.startsWith("video/") ? (
          <video
            controls
            preload="metadata"
            src={asset.publicUrl}
            data-cms-media-slot="primary"
          >
            Votre navigateur ne prend pas en charge la vidéo.
          </video>
        ) : editing ? (
          <MediaPlaceholder video />
        ) : null}
        <div>
          <EditableCopy
            as="p"
            field="eyebrow"
            value={eyebrow}
            editing={editing}
          />
          <EditableCopy as="h2" field="title" value={title} editing={editing} />
          <EditableCopy as="p" field="text" value={text} editing={editing} />
        </div>
      </section>
    );
  }

  if (type === "TABS") {
    return (
      <section
        {...cmsSectionDesignProps(payload, "cms-public-section cms-public-tabs-section")}
        {...sectionProps}
      >
        <CmsSectionBackground payload={payload} mediaById={mediaById} />
        <EditableCopy
          as="p"
          field="eyebrow"
          value={eyebrow}
          editing={editing}
        />
        <EditableCopy as="h2" field="title" value={title} editing={editing} />
        <EditableCopy as="p" field="text" value={text} editing={editing} />
        {items.length > 0 ? (
          <CmsTabs
            items={items.map((item) => ({
              title: String(item.title ?? ""),
              text: String(item.text ?? ""),
            }))}
          />
        ) : editing ? (
          <ItemsPlaceholder />
        ) : null}
      </section>
    );
  }

  if (type === "CARD") {
    return (
      <section
        {...cmsSectionDesignProps(payload, "cms-public-section cms-public-card")}
        {...sectionProps}
      >
        <CmsSectionBackground payload={payload} mediaById={mediaById} />
        {asset?.mimeType.startsWith("image/") ? (
          <div className="cms-public-image" data-cms-media-slot="primary">
            <Image
              src={asset.publicUrl}
              alt={asset.altText}
              fill
              sizes="(max-width: 700px) 100vw, 400px"
            />
            <CmsPrimaryImageOverlay />
          </div>
        ) : editing ? (
          <MediaPlaceholder />
        ) : null}
        <EditableCopy
          as="p"
          field="eyebrow"
          value={eyebrow}
          editing={editing}
        />
        <EditableCopy as="h2" field="title" value={title} editing={editing} />
        <EditableCopy as="p" field="text" value={text} editing={editing} />
        {href && label ? (
          <Link className="button button--primary" href={href}>
            {label}
          </Link>
        ) : null}
      </section>
    );
  }

  if (type === "CUSTOM_HTML") {
    const html = stringValue(payload, "html");
    return (
      <section
        {...cmsSectionDesignProps(payload, "cms-public-section cms-public-html")}
        {...sectionProps}
      >
        {html ? (
          // Deliberate raw-HTML embed block, authored only by trusted workspace editors.
          <div
            className="cms-public-html__content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : editing ? (
          <div className="cms-editor-placeholder">
            Ajoutez du code HTML dans le panneau de gauche.
          </div>
        ) : null}
      </section>
    );
  }

  if (type === "DIVIDER") {
    return <hr className="cms-public-divider" {...sectionProps} />;
  }

  if (editing && !title && !text && !eyebrow) {
    return (
      <EditorPlaceholder
        sectionId={sectionId}
        type={type}
        label={blockLabel}
        message="Sélectionnez ce bloc pour ajouter son contenu."
      />
    );
  }

  return (
    <section
      {...cmsSectionDesignProps(payload, "cms-public-section")}
      {...sectionProps}
    >
      <CmsSectionBackground payload={payload} mediaById={mediaById} />
      <EditableCopy as="p" field="eyebrow" value={eyebrow} editing={editing} />
      <EditableCopy as="h2" field="title" value={title} editing={editing} />
      <EditableCopy as="p" field="text" value={text} editing={editing} />
    </section>
  );
}

export function stringValue(
  payload: Readonly<Record<string, unknown>>,
  key: string,
): string {
  return typeof payload[key] === "string" ? payload[key] : "";
}

function stringItems(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function objectItems(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function nestedColumns(value: unknown): readonly (readonly NestedBlock[])[] {
  if (!Array.isArray(value)) return [];
  return value.map((column) => {
    if (!Array.isArray(column)) return [];
    return column.flatMap((entry): NestedBlock[] => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return [];
      }
      const block = entry as Record<string, unknown>;
      if (
        typeof block.id !== "string" ||
        typeof block.type !== "string" ||
        !isNestableBlockType(block.type)
      ) {
        return [];
      }
      const payload =
        block.payload &&
        typeof block.payload === "object" &&
        !Array.isArray(block.payload)
          ? (block.payload as Record<string, unknown>)
          : {};
      return [{ id: block.id, type: block.type, payload }];
    });
  });
}

function EditableCopy({
  as: Tag,
  field,
  value,
  editing,
}: Readonly<{
  as: "p" | "h1" | "h2";
  field: string;
  value: string;
  editing: boolean;
}>) {
  if (!value && !editing) return null;
  return (
    <Tag data-cms-field={field} data-cms-empty={!value || undefined}>
      {value ||
        `Cliquez pour ajouter ${field === "eyebrow" ? "un sur-titre" : field === "title" ? "un titre" : "du texte"}`}
    </Tag>
  );
}

function MediaPlaceholder({ video = false }: Readonly<{ video?: boolean }>) {
  return (
    <div className="cms-editor-media-placeholder" data-cms-media-slot="primary">
      <strong>{video ? "Choisir une vidéo" : "Choisir une image"}</strong>
      <span>Cliquez ici pour ouvrir la médiathèque.</span>
    </div>
  );
}

function ItemsPlaceholder() {
  return (
    <div className="cms-editor-placeholder">
      Ajoutez les éléments de ce bloc dans le panneau de gauche.
    </div>
  );
}

function EditorPlaceholder({
  sectionId,
  type,
  label,
  message,
}: Readonly<{
  sectionId: string;
  type: string;
  label: string;
  message: string;
}>) {
  return (
    <section
      className="cms-public-section cms-editor-placeholder"
      data-cms-section-id={sectionId}
      data-cms-section-type={type}
    >
      <strong>{label}</strong>
      <span>{message}</span>
    </section>
  );
}
