import Image from "next/image";
import Link from "next/link";

import {
  isEvidencePublishable,
  isEvidenceSectionType,
} from "@/modules/content/domain/evidence-section";
import { getPageBlockDefinition } from "@/modules/content/domain/page-block-registry";

import { EvidenceSection } from "./evidence-section";
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

export function CmsSection({
  sectionId,
  type,
  payload,
  mediaById,
  services,
  worldKey,
  editing = false,
}: Readonly<{
  sectionId: string;
  type: string;
  payload: Record<string, unknown>;
  mediaById: ReadonlyMap<string, CmsMediaAsset>;
  services: readonly CmsPublicService[];
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

  if (type === "GALLERY" || type === "LOGO_CLOUD" || type === "PORTFOLIO") {
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

  if (type === "FAQ") {
    return (
      <section
        {...cmsSectionDesignProps(payload, "cms-public-section cms-public-faq")}
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
              {String(item.title ?? "Question")}
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

  if (
    type === "FEATURE_GRID" ||
    type === "STEPS" ||
    type === "COLUMNS" ||
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
          {services.map((service) => (
            <article key={service.slug}>
              <h3>
                <Link
                  href={
                    worldKey === "kwaliti-print"
                      ? `/kwaliti-print/${service.slug}`
                      : `/services/${service.slug}`
                  }
                >
                  {service.name}
                </Link>
              </h3>
              <p>{service.description}</p>
            </article>
          ))}
          {editing && services.length === 0 ? (
            <div className="cms-editor-placeholder">Aucun service publié.</div>
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
