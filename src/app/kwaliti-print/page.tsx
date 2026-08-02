import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { CmsPreviewBridge } from "@/app/_components/cms-preview-bridge";
import { HeroParallax } from "@/app/_components/hero-parallax";
import { MagneticButton } from "@/app/_components/magnetic-button";
import { Reveal } from "@/app/_components/reveal";
import {
  emptyHomeContent,
  getCmsHomeContent,
  type CmsHomeMediaAsset,
  type CmsHomeSection,
} from "@/app/_lib/cms-home";
import { groupServicesByFamily } from "@/app/_lib/group-services-by-family";
import { recordPageView } from "@/modules/content/application/record-page-view";
import { prisma } from "@/infrastructure/shared/prisma-client";
import { listPublishedServiceFamilies } from "@/modules/content/application/public/list-published-service-families";
import { listPublishedServices } from "@/modules/content/application/public/list-published-services";
import { PrismaServiceFamilyRepository } from "@/modules/content/infrastructure/prisma-service-family-repository";
import { PrismaServiceRepository } from "@/modules/content/infrastructure/prisma-service-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { CmsSection } from "@/app/(marketing)/_components/cms-section";
import {
  CmsPrimaryImageOverlay,
  CmsSectionBackground,
  cmsSectionDesignProps,
} from "@/app/(marketing)/_components/cms-section-design";
import { OrganizationJsonLd } from "@/app/(marketing)/_components/organization-json-ld";

const KWALITI_DESCRIPTION =
  "Kwaliti Print transforme les identités et les idées en objets et surfaces imprimés avec une approche précise et orientée production.";

export const revalidate = 60;
export const metadata: Metadata = { description: KWALITI_DESCRIPTION };

const DEFAULT_CAPABILITIES = [
  "Textile personnalisé",
  "Signalétique",
  "Supports événementiels",
  "Objets publicitaires",
];
const DEFAULT_SECTIONS: readonly CmsHomeSection[] = [
  fallbackSection("kp-home-hero", "HERO", 0),
  fallbackSection("kp-home-services", "SERVICE_INDEX", 1),
  fallbackSection("kp-home-features", "FEATURE_GRID", 2),
  fallbackSection("kp-home-cta", "CTA", 3),
];

type Services = Awaited<ReturnType<typeof listPublishedServices>>;
type Families = Awaited<ReturnType<typeof listPublishedServiceFamilies>>;

export default async function KwalitiPrintHomePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    preview?: string;
    visualEditor?: string;
    share?: string;
  }>;
}>) {
  const { preview, visualEditor, share } = await searchParams;
  const deps = {
    services: new PrismaServiceRepository(prisma),
    families: new PrismaServiceFamilyRepository(prisma),
    worlds: new PrismaWorldRepository(prisma),
  };
  const [capabilities, families, cms] = await Promise.all([
    listPublishedServices(deps, { worldKey: "kwaliti-print" }).catch(() => []),
    listPublishedServiceFamilies(deps, { worldKey: "kwaliti-print" }).catch(
      () => [],
    ),
    getCmsHomeContent("kwaliti-print", preview, share).catch(emptyHomeContent),
  ]);
  if (!preview && !share && cms.pageId) recordPageView(prisma, cms.pageId);
  const sections = cms.sections.length ? cms.sections : DEFAULT_SECTIONS;
  const mediaById = new Map(cms.mediaAssets.map((asset) => [asset.id, asset]));

  return (
    <main id="main-content" className="kp-home">
      {visualEditor === "1" ? <CmsPreviewBridge /> : null}
      <OrganizationJsonLd
        name="Kwaliti Print"
        path="/kwaliti-print"
        description={KWALITI_DESCRIPTION}
        parentName="Pixel&Digital"
      />
      {sections.map((section) => (
        <KwalitiHomeSection
          key={section.id}
          section={section}
          mediaById={mediaById}
          capabilities={capabilities}
          families={families}
          editing={visualEditor === "1"}
        />
      ))}
    </main>
  );
}

function KwalitiHomeSection({
  section,
  mediaById,
  capabilities,
  families,
  editing,
}: Readonly<{
  section: CmsHomeSection;
  mediaById: ReadonlyMap<string, CmsHomeMediaAsset>;
  capabilities: Services;
  families: Families;
  editing: boolean;
}>) {
  const payload = section.payload;
  const sectionProps = {
    "data-cms-section-id": section.id,
    "data-cms-section-type": section.sectionType,
  };

  if (section.sectionType === "HERO") {
    const asset = primaryMedia(payload, mediaById);
    return (
      <>
        <section
          {...cmsSectionDesignProps(payload, "kp-hero")}
          {...sectionProps}
        >
          <CmsSectionBackground
            payload={payload}
            mediaById={mediaById}
            priority
          />
          <div className="kp-hero__copy">
            <Reveal>
              <p className="kp-eyebrow" data-cms-field="eyebrow">
                {value(payload, "eyebrow") ||
                  "Impression · Personnalisation · Production"}
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 data-cms-field="title">
                {value(payload, "title") ||
                  "Vos idées méritent de sortir de l’écran."}
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="kp-hero__lede" data-cms-field="text">
                {value(payload, "text") ||
                  "Kwaliti Print transforme vos visuels en supports concrets, visibles et bien finis — du prototype à la série."}
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="kp-hero__actions">
                <MagneticButton
                  href={value(payload, "href") || "/kwaliti-print/devis"}
                  className="button button--kwaliti"
                >
                  {value(payload, "label") || "Demander un devis"}
                </MagneticButton>
                <a href="#capacites-kp" className="kp-text-link">
                  Voir les possibilités
                </a>
              </div>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <figure className="kp-hero__visual" data-cms-media-slot="primary">
              <HeroParallax className="kp-hero__parallax" strength={4}>
                {asset?.mimeType.startsWith("image/") ? (
                  <Image
                    className="kp-hero__photo"
                    src={asset.publicUrl}
                    alt={asset.altText}
                    fill
                    priority
                    sizes="(max-width: 760px) 100vw, 44vw"
                  />
                ) : (
                  <div className="kp-hero__media-pending">
                    <span>Photographie produit</span>
                    <strong>
                      {editing
                        ? "Cliquez pour choisir une image"
                        : "Visuel matière en attente de validation"}
                    </strong>
                    <p>
                      {editing
                        ? "La médiathèque s’ouvrira dans l’éditeur."
                        : "Cet espace accueillera uniquement une image réelle, sourcée et approuvée."}
                    </p>
                  </div>
                )}
              </HeroParallax>
              {asset?.mimeType.startsWith("image/") ? (
                <CmsPrimaryImageOverlay />
              ) : null}
              <span
                className="kp-hero__measure kp-hero__measure--top"
                aria-hidden="true"
              >
                240 mm
              </span>
              <span
                className="kp-hero__measure kp-hero__measure--side"
                aria-hidden="true"
              >
                échelle 1:1
              </span>
              {asset ? <figcaption>{asset.altText}</figcaption> : null}
            </figure>
          </Reveal>
        </section>
        <section className="kp-strip" aria-label="Catégories principales">
          <div className="kp-strip__track">
            {DEFAULT_CAPABILITIES.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>
      </>
    );
  }

  if (section.sectionType === "SERVICE_INDEX") {
    const groups = groupServicesByFamily(capabilities, families);
    return (
      <section
        id="capacites-kp"
        {...cmsSectionDesignProps(payload, "kp-capabilities")}
        {...sectionProps}
      >
        <CmsSectionBackground payload={payload} mediaById={mediaById} />
        <div className="kp-section-heading">
          <p data-cms-field="eyebrow">
            {value(payload, "eyebrow") || "Ce qu’on produit"}
          </p>
          <h2 data-cms-field="title">
            {value(payload, "title") ||
              "Des supports qui font exister votre marque dans le vrai monde."}
          </h2>
        </div>
        {groups.length === 0 ? (
          <div className="kp-capabilities__fallback">
            {DEFAULT_CAPABILITIES.map((item, index) => (
              <article key={item}>
                <span>0{index + 1}</span>
                <h3>{item}</h3>
              </article>
            ))}
          </div>
        ) : (
          <div className="kp-capabilities__groups">
            {groups.map((group, groupIndex) => (
              <section key={group.label} className="kp-capability-group">
                <p>0{groupIndex + 1}</p>
                <div>
                  <h3>{group.label}</h3>
                  <div className="kp-capability-group__links">
                    {group.services.map((capability) => (
                      <Link
                        key={capability.slug}
                        href={`/kwaliti-print/devis?service=${encodeURIComponent(capability.slug)}`}
                      >
                        {capability.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    );
  }

  if (section.sectionType === "FEATURE_GRID") {
    const items = itemTitles(payload);
    return (
      <section
        {...cmsSectionDesignProps(payload, "kp-quality")}
        {...sectionProps}
      >
        <CmsSectionBackground payload={payload} mediaById={mediaById} />
        <div>
          <p data-cms-field="eyebrow">
            {value(payload, "eyebrow") || "Notre exigence"}
          </p>
          <h2 data-cms-field="title">
            {value(payload, "title") ||
              "Le bon support. La bonne finition. Le bon délai."}
          </h2>
          {value(payload, "text") ? (
            <p data-cms-field="text">{value(payload, "text")}</p>
          ) : null}
        </div>
        <div className="kp-quality__points">
          {(items.length
            ? items
            : [
                "Conseil matière",
                "Contrôle des fichiers",
                "Production suivie",
                "Finition propre",
              ]
          ).map((item, index) => (
            <span
              key={`${item}-${index}`}
              data-cms-item-index={index}
              data-cms-item-field="title"
            >
              {item}
            </span>
          ))}
        </div>
      </section>
    );
  }

  if (section.sectionType === "CTA") {
    return (
      <section
        {...cmsSectionDesignProps(payload, "kp-closing")}
        {...sectionProps}
      >
        <CmsSectionBackground payload={payload} mediaById={mediaById} />
        <p data-cms-field="eyebrow">
          {value(payload, "eyebrow") || "Un besoin précis ou juste une idée ?"}
        </p>
        <h2 data-cms-field="title">
          {value(payload, "title") ||
            "On vous aide à choisir la bonne manière de l’imprimer."}
        </h2>
        {value(payload, "text") ? (
          <p data-cms-field="text">{value(payload, "text")}</p>
        ) : null}
        <MagneticButton
          href={value(payload, "href") || "/kwaliti-print/devis"}
          className="button button--kwaliti"
        >
          {value(payload, "label") || "Obtenir un devis"}
        </MagneticButton>
      </section>
    );
  }

  return (
    <CmsSection
      sectionId={section.id}
      type={section.sectionType}
      payload={payload as Record<string, unknown>}
      mediaById={mediaById}
      services={capabilities}
      worldKey="kwaliti-print"
      editing={editing}
    />
  );
}

function fallbackSection(
  id: string,
  sectionType: string,
  order: number,
): CmsHomeSection {
  return { id, sectionType, order, payload: {} };
}

function value(
  payload: Readonly<Record<string, unknown>>,
  key: string,
): string {
  return typeof payload[key] === "string" ? payload[key].trim() : "";
}

function primaryMedia(
  payload: Readonly<Record<string, unknown>>,
  mediaById: ReadonlyMap<string, CmsHomeMediaAsset>,
) {
  const id = value(payload, "mediaId");
  return id ? mediaById.get(id) : undefined;
}

function itemTitles(payload: Readonly<Record<string, unknown>>): string[] {
  if (!Array.isArray(payload.items)) return [];
  return payload.items.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const title = (item as Record<string, unknown>).title;
    return typeof title === "string" && title.trim() ? [title.trim()] : [];
  });
}
