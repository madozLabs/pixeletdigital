import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { CmsPreviewBridge } from "@/app/_components/cms-preview-bridge";
import { KineticHeading } from "@/app/_components/kinetic-heading";
import { MagneticButton } from "@/app/_components/magnetic-button";
import { Reveal } from "@/app/_components/reveal";
import {
  emptyHomeContent,
  getCmsHomeContent,
  type CmsHomeMediaAsset,
  type CmsHomeSection,
} from "@/app/_lib/cms-home";
import { groupServicesByFamily } from "@/app/_lib/group-services-by-family";
import { resolveLocalImage, resolveLocalVideo } from "@/app/_lib/local-image";
import { HeroVideoBackground } from "@/app/_components/hero-video-background";
import { recordPageView } from "@/modules/content/application/record-page-view";
import { prisma } from "@/infrastructure/shared/prisma-client";
import { listPublishedServiceFamilies } from "@/modules/content/application/public/list-published-service-families";
import { listPublishedServices } from "@/modules/content/application/public/list-published-services";
import { PrismaServiceFamilyRepository } from "@/modules/content/infrastructure/prisma-service-family-repository";
import { PrismaServiceRepository } from "@/modules/content/infrastructure/prisma-service-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { CmsSection, type CmsPublicPageSummary } from "./_components/cms-section";
import {
  CmsPrimaryImageOverlay,
  CmsSectionBackground,
  cmsSectionDesignProps,
} from "./_components/cms-section-design";
import { OrganizationJsonLd } from "./_components/organization-json-ld";

const HOME_TITLE = "Pixel&Digital — Agence créative et digitale";
const HOME_DESCRIPTION =
  "Agence créative et digitale : stratégie, identité, contenu, digital et production pour construire des marques visibles et crédibles.";

export const revalidate = 60;

export async function generateMetadata({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ preview?: string; share?: string }>;
}>): Promise<Metadata> {
  const { preview, share } = await searchParams;
  const cms = await getCmsHomeContent("pixel-digital", preview, share).catch(
    emptyHomeContent,
  );
  const title = cms.seo?.title || HOME_TITLE;
  const description = cms.seo?.description || HOME_DESCRIPTION;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/" },
    openGraph: {
      title,
      description,
      url: "/",
      type: "website",
      images: cms.seo?.ogImageUrl ? [{ url: cms.seo.ogImageUrl }] : undefined,
    },
    robots: preview || cms.isSharedPreview ? { index: false, follow: false } : undefined,
  };
}

const MANIFESTO = [
  "Les likes paient rarement les factures.",
  "Les bonnes stratégies, si.",
];
const DEFAULT_HERO_LINES = ["Avec nous,", "vous allez", "prendre terrain."];

const DEFAULT_SECTIONS: readonly CmsHomeSection[] = [
  fallbackSection("home-hero", "HERO", 0),
  fallbackSection("home-manifesto", "RICH_TEXT", 1),
  fallbackSection("home-services", "SERVICE_INDEX", 2),
  fallbackSection("home-steps", "STEPS", 3),
  fallbackSection("home-media", "MEDIA", 4),
  fallbackSection("home-cta", "CTA", 5),
];

type Services = Awaited<ReturnType<typeof listPublishedServices>>;
type Families = Awaited<ReturnType<typeof listPublishedServiceFamilies>>;

export default async function HomePage({
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
  const [services, families, cms] = await Promise.all([
    listPublishedServices(deps, { worldKey: "pixel-digital" }).catch(() => []),
    listPublishedServiceFamilies(deps, { worldKey: "pixel-digital" }).catch(
      () => [],
    ),
    getCmsHomeContent("pixel-digital", preview, share).catch(emptyHomeContent),
  ]);
  if (!preview && !share && cms.pageId) recordPageView(prisma, cms.pageId);
  const sections = cms.sections.length ? cms.sections : DEFAULT_SECTIONS;
  const mediaById = new Map(cms.mediaAssets.map((asset) => [asset.id, asset]));
  const publicPages = await resolveCollectionPages(sections);

  return (
    <main id="main-content" className="public-home">
      {visualEditor === "1" ? <CmsPreviewBridge /> : null}
      {cms.isSharedPreview ? (
        <aside className="cms-preview-banner">
          Aperçu partagé · aucune modification n’est encore publique
        </aside>
      ) : null}
      <OrganizationJsonLd
        name="Pixel&Digital"
        path="/"
        description={HOME_DESCRIPTION}
      />
      {sections.map((section) => (
        <PixelHomeSection
          key={section.id}
          section={section}
          mediaById={mediaById}
          services={services}
          families={families}
          pages={publicPages}
          editing={visualEditor === "1"}
        />
      ))}
    </main>
  );
}

// Mirrors the collection-page resolution in [slug]/page.tsx, needed here
// because SERVICE_INDEX blocks with source "PAGES" (e.g. a portfolio grid)
// can appear on this bespoke home route too.
async function resolveCollectionPages(
  sections: readonly CmsHomeSection[],
): Promise<readonly CmsPublicPageSummary[]> {
  const pageTypeFilters = [
    ...new Set(
      sections
        .filter(
          (section) =>
            section.sectionType === "SERVICE_INDEX" &&
            (section.payload as Record<string, unknown>).source === "PAGES",
        )
        .map((section) => {
          const filter = (section.payload as Record<string, unknown>)
            .pageTypeFilter;
          return typeof filter === "string" ? filter.trim() : "";
        }),
    ),
  ];
  if (!pageTypeFilters.length) return [];
  const needsAllPageTypes = pageTypeFilters.includes("");
  const collectionPages = await prisma.page
    .findMany({
      where: {
        worldKey: "pixel-digital",
        lifecycle: "PUBLISHED",
        pageKind: { not: "COMPONENT_LIBRARY" },
        ...(needsAllPageTypes
          ? {}
          : { pageType: { in: pageTypeFilters.filter(Boolean) } }),
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    })
    .catch(() => []);
  return collectionPages.map((collectionPage) => ({
    slug: collectionPage.slug,
    routePath: collectionPage.routePath,
    pageType: collectionPage.pageType,
    title: collectionPage.title,
    description: "",
  }));
}

function PixelHomeSection({
  section,
  mediaById,
  services,
  families,
  pages,
  editing,
}: Readonly<{
  section: CmsHomeSection;
  mediaById: ReadonlyMap<string, CmsHomeMediaAsset>;
  services: Services;
  families: Families;
  pages: readonly CmsPublicPageSummary[];
  editing: boolean;
}>) {
  const payload = section.payload;
  const type =
    section.sectionType === "TEXT" ? "RICH_TEXT" : section.sectionType;
  const sectionProps = {
    "data-cms-section-id": section.id,
    "data-cms-section-type": section.sectionType,
  };

  if (type === "HERO") {
    const title = value(payload, "title");
    const heroLines = title
      ? title
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      : DEFAULT_HERO_LINES;
    const asset = primaryMedia(payload, mediaById);
    const localHeroVideo = resolveLocalVideo("pixel-digital/hero/hero-bg.mp4");
    const localHeroImage = resolveLocalImage("pixel-digital/hero/hero-bg.jpg");
    return (
      <section
        {...cmsSectionDesignProps(payload, "home-hero")}
        {...sectionProps}
      >
        <CmsSectionBackground
          payload={payload}
          mediaById={mediaById}
          priority
        />
        <div className="home-hero__media">
          {asset?.mimeType.startsWith("video/") ? (
            <HeroVideoBackground
              className="home-hero__media-video"
              src={asset.publicUrl}
              poster={localHeroImage ?? undefined}
              alt={asset.altText}
            />
          ) : localHeroVideo ? (
            <HeroVideoBackground
              className="home-hero__media-video"
              src={localHeroVideo}
              poster={localHeroImage ?? undefined}
              alt="Tournage en studio Pixel&Digital"
            />
          ) : asset?.mimeType.startsWith("image/") ? (
            <Image
              className="home-hero__media-image"
              src={asset.publicUrl}
              alt={asset.altText}
              fill
              priority
              sizes="100vw"
            />
          ) : localHeroImage ? (
            <Image
              className="home-hero__media-image"
              src={localHeroImage}
              alt="Atelier Pixel&Digital en pleine activité"
              fill
              priority
              sizes="100vw"
            />
          ) : (
            <div className="home-hero__media-fallback" aria-hidden="true" />
          )}
          <div className="home-hero__overlay" aria-hidden="true" />
        </div>

        <div className="home-hero__content">
          <div className="home-hero__eyebrow" data-cms-field="eyebrow">
            {value(payload, "eyebrow") || "Agence créative & digitale"}
          </div>
          <div className="home-hero__headline-row">
            <KineticHeading
              className="home-hero__title"
              cmsField="title"
              text={
                heroLines.length > 2
                  ? [heroLines[0], heroLines[1], heroLines.slice(2).join(" ")]
                  : heroLines
              }
              accentLastLine={heroLines.length > 2}
            />
            <Reveal delay={0.25}>
              <p className="home-hero__lede" data-cms-field="text">
                {value(payload, "text") ||
                  "Nous construisons des marques visibles, crédibles et difficiles à oublier de la stratégie à l’exécution."}
              </p>
            </Reveal>
          </div>
          <div className="home-hero__divider" aria-hidden="true" />
          <Reveal delay={0.35}>
            <div className="home-hero__footer-row">
              <MagneticButton
                href={value(payload, "href") || "/contact"}
                className="button button--primary home-hero__cta"
              >
                {value(payload, "label") || "Lancer un projet"}
              </MagneticButton>
              <Link href="#capacites" className="home-hero__secondary-link">
                Voir nos expertises
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    );
  }

  if (type === "RICH_TEXT") {
    const lines = value(payload, "title")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return (
      <section
        {...cmsSectionDesignProps(payload, "home-manifesto")}
        {...sectionProps}
      >
        <CmsSectionBackground payload={payload} mediaById={mediaById} />
        <Reveal>
          <p className="home-manifesto__label" data-cms-field="eyebrow">
            {value(payload, "eyebrow") || "Notre façon de voir les choses"}
          </p>
          <h2 className="home-manifesto__title" data-cms-field="title">
            {(lines.length ? lines : MANIFESTO).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h2>
          {value(payload, "text") ? (
            <p data-cms-field="text">{value(payload, "text")}</p>
          ) : null}
        </Reveal>
      </section>
    );
  }

  if (type === "SERVICE_INDEX" && value(payload, "source") !== "PAGES") {
    const groups = groupServicesByFamily(services, families);
    return (
      <section
        id="capacites"
        {...cmsSectionDesignProps(payload, "home-services")}
        {...sectionProps}
      >
        <CmsSectionBackground payload={payload} mediaById={mediaById} />
        <div className="home-section-head">
          <Reveal>
            <p className="home-section-head__kicker" data-cms-field="eyebrow">
              {value(payload, "eyebrow") || "Ce qu’on sait faire"}
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="home-section-head__title" data-cms-field="title">
              {value(payload, "title") ||
                "Une seule équipe pour faire avancer toute la marque."}
            </h2>
          </Reveal>
        </div>
        {groups.length === 0 ? (
          <p className="section__empty">Notre catalogue arrive bientôt.</p>
        ) : (
          <div className="home-services__list">
            {groups.map((group, groupIndex) => (
              <Reveal key={group.label} delay={groupIndex * 0.05}>
                <article className="home-service-row">
                  <div className="home-service-row__index">
                    0{groupIndex + 1}
                  </div>
                  <div>
                    <h3>{group.label}</h3>
                    <div className="home-service-row__links">
                      {group.services.map((service) => (
                        <Link
                          key={service.slug}
                          href={`/services/${service.slug}`}
                        >
                          {service.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        )}
      </section>
    );
  }

  if (type === "STEPS") {
    const steps = itemTitles(payload);
    return (
      <section
        id="preuve"
        {...cmsSectionDesignProps(payload, "home-method")}
        {...sectionProps}
      >
        <CmsSectionBackground payload={payload} mediaById={mediaById} />
        <div className="home-method__intro">
          <p data-cms-field="eyebrow">
            {value(payload, "eyebrow") || "Une méthode simple"}
          </p>
          <h2 data-cms-field="title">
            {value(payload, "title") ||
              "On pense juste. On crée fort. On exécute proprement."}
          </h2>
        </div>
        <div className="home-method__steps">
          {(steps.length
            ? steps
            : ["Comprendre", "Positionner", "Créer", "Déployer"]
          ).map((step, index) => (
            <Reveal key={`${step}-${index}`} delay={index * 0.08}>
              <div className="home-method__step">
                <span>0{index + 1}</span>
                <strong data-cms-item-index={index} data-cms-item-field="title">
                  {step}
                </strong>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    );
  }

  if (type === "MEDIA") {
    const asset = primaryMedia(payload, mediaById);
    return (
      <section
        {...cmsSectionDesignProps(payload, "home-kwaliti")}
        {...sectionProps}
      >
        <CmsSectionBackground payload={payload} mediaById={mediaById} />
        <div className="home-kwaliti__visual" data-cms-media-slot="primary">
          {asset?.mimeType.startsWith("image/") ? (
            <>
              <Image
                className="home-kwaliti__image"
                src={asset.publicUrl}
                alt={asset.altText}
                fill
                sizes="(max-width: 760px) 100vw, 50vw"
              />
              <CmsPrimaryImageOverlay />
            </>
          ) : (
            <>
              <span>K</span>
              <span>P</span>
            </>
          )}
        </div>
        <div className="home-kwaliti__content">
          <p data-cms-field="eyebrow">
            {value(payload, "eyebrow") || "Notre bras production"}
          </p>
          <h2 data-cms-field="title">
            {value(payload, "title") ||
              "Kwaliti Print transforme vos idées en objets qu’on remarque."}
          </h2>
          {value(payload, "text") ? (
            <p data-cms-field="text">{value(payload, "text")}</p>
          ) : null}
          <MagneticButton
            href={value(payload, "href") || "/kwaliti-print"}
            className="button button--kwaliti"
          >
            {value(payload, "label") || "Découvrir Kwaliti Print"}
          </MagneticButton>
        </div>
      </section>
    );
  }

  if (type === "CTA") {
    return (
      <section
        {...cmsSectionDesignProps(payload, "home-closing")}
        {...sectionProps}
      >
        <CmsSectionBackground payload={payload} mediaById={mediaById} />
        <Reveal>
          <p data-cms-field="eyebrow">
            {value(payload, "eyebrow") ||
              "Être partout ne sert à rien si personne ne se souvient de vous."}
          </p>
          <h2 data-cms-field="title">
            {value(payload, "title") ||
              "Faisons quelque chose qu’on ne peut pas ignorer."}
          </h2>
          {value(payload, "text") ? (
            <p data-cms-field="text">{value(payload, "text")}</p>
          ) : null}
          <MagneticButton
            href={value(payload, "href") || "/contact"}
            className="button button--primary"
          >
            {value(payload, "label") || "Parler à Pixel&Digital"}
          </MagneticButton>
        </Reveal>
      </section>
    );
  }

  return (
    <CmsSection
      sectionId={section.id}
      type={section.sectionType}
      payload={payload as Record<string, unknown>}
      mediaById={mediaById}
      services={services}
      pages={pages}
      worldKey="pixel-digital"
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
