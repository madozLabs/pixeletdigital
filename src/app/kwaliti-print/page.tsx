import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { listPublishedServiceFamilies } from "@/modules/content/application/public/list-published-service-families";
import { listPublishedServices } from "@/modules/content/application/public/list-published-services";
import { PrismaServiceFamilyRepository } from "@/modules/content/infrastructure/prisma-service-family-repository";
import { PrismaServiceRepository } from "@/modules/content/infrastructure/prisma-service-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { HeroParallax } from "@/app/_components/hero-parallax";
import { MagneticButton } from "@/app/_components/magnetic-button";
import { Reveal } from "@/app/_components/reveal";
import { getCmsHomeContent } from "@/app/_lib/cms-home";
import { groupServicesByFamily } from "@/app/_lib/group-services-by-family";
import { OrganizationJsonLd } from "@/app/(marketing)/_components/organization-json-ld";

const KWALITI_DESCRIPTION =
  "Kwaliti Print transforme les identités et les idées en objets et surfaces imprimés avec une approche précise et orientée production.";

// See (marketing)/page.tsx for why this is ISR rather than force-dynamic.
export const revalidate = 60;

export const metadata: Metadata = {
  description: KWALITI_DESCRIPTION,
};

const DEFAULT_CAPABILITIES = [
  "Textile personnalisé",
  "Signalétique",
  "Supports événementiels",
  "Objets publicitaires",
];
export default async function KwalitiPrintHomePage() {
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
    getCmsHomeContent("kwaliti-print").catch(() => ({
      hero: null,
      closing: null,
    })),
  ]);
  const groups = groupServicesByFamily(capabilities, families);

  return (
    <main id="main-content" className="kp-home">
      <OrganizationJsonLd
        name="Kwaliti Print"
        path="/kwaliti-print"
        description={KWALITI_DESCRIPTION}
        parentName="Pixel&Digital"
      />
      <section className="kp-hero">
        <div className="kp-hero__copy">
          <Reveal>
            <p className="kp-eyebrow">
              {cms.hero?.eyebrow ??
                "Impression · Personnalisation · Production"}
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h1>
              {cms.hero?.titleLines.join(" ") ||
                "Vos idées méritent de sortir de l’écran."}
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="kp-hero__lede">
              {cms.hero?.lede ??
                "Kwaliti Print transforme vos visuels en supports concrets, visibles et bien finis — du prototype à la série."}
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="kp-hero__actions">
              <MagneticButton
                href={cms.hero?.ctaHref ?? "/kwaliti-print/devis"}
                className="button button--kwaliti"
              >
                {cms.hero?.ctaLabel ?? "Demander un devis"}
              </MagneticButton>
              <a href="#capacites-kp" className="kp-text-link">
                Voir les possibilités
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <figure className="kp-hero__visual">
            <HeroParallax className="kp-hero__parallax" strength={4}>
              {cms.hero?.imageUrl ? (
                <Image
                  className="kp-hero__photo"
                  src={cms.hero.imageUrl}
                  alt={cms.hero.imageAlt}
                  fill
                  priority
                  sizes="(max-width: 760px) 100vw, 44vw"
                />
              ) : (
                <div className="kp-hero__media-pending">
                  <span>Photographie produit</span>
                  <strong>Visuel matière en attente de validation</strong>
                  <p>
                    Cet espace accueillera uniquement une image réelle, sourcée
                    et approuvée.
                  </p>
                </div>
              )}
            </HeroParallax>
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
            {cms.hero?.imageUrl ? (
              <figcaption>{cms.hero.imageAlt}</figcaption>
            ) : null}
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

      <section id="capacites-kp" className="kp-capabilities">
        <div className="kp-section-heading">
          <p>Ce qu’on produit</p>
          <h2>
            Des supports qui font exister votre marque dans le vrai monde.
          </h2>
        </div>

        {capabilities.length === 0 ? (
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

      <section className="kp-quality">
        <div>
          <p>Notre exigence</p>
          <h2>Le bon support. La bonne finition. Le bon délai.</h2>
        </div>
        <div className="kp-quality__points">
          <span>Conseil matière</span>
          <span>Contrôle des fichiers</span>
          <span>Production suivie</span>
          <span>Finition propre</span>
        </div>
      </section>
      <section className="kp-closing">
        <p>{cms.closing?.kicker ?? "Un besoin précis ou juste une idée ?"}</p>
        <h2>
          {cms.closing?.title ??
            "On vous aide à choisir la bonne manière de l’imprimer."}
        </h2>
        <MagneticButton
          href={cms.closing?.ctaHref ?? "/kwaliti-print/devis"}
          className="button button--kwaliti"
        >
          {cms.closing?.ctaLabel ?? "Obtenir un devis"}
        </MagneticButton>
      </section>
    </main>
  );
}
