import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";

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
import { OrganizationJsonLd } from "./_components/organization-json-ld";

const HOME_DESCRIPTION =
  "Agence créative et digitale : stratégie, identité, contenu, digital et production pour construire des marques visibles et crédibles.";

export const metadata: Metadata = {
  title: { absolute: "Pixel&Digital — Agence créative et digitale" },
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Pixel&Digital — Agence créative et digitale",
    description: HOME_DESCRIPTION,
    url: "/",
    type: "website",
  },
};

// Static-generated with periodic revalidation instead of force-dynamic: an
// isolated DB blip now serves the last good render instead of crashing, and
// site-content/services actions call revalidatePath("/") on publish so
// editors still see changes immediately rather than waiting out the window.
export const revalidate = 60;

const MANIFESTO = [
  "Les likes paient rarement les factures.",
  "Les bonnes stratégies, si.",
];

const DEFAULT_HERO_LINES = ["Avec nous,", "vous allez", "prendre terrain."];

export default async function HomePage() {
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
    getCmsHomeContent("pixel-digital").catch(() => ({
      hero: null,
      closing: null,
    })),
  ]);

  const groups = groupServicesByFamily(services, families);
  const heroLines =
    cms.hero && cms.hero.titleLines.length >= 1
      ? cms.hero.titleLines
      : DEFAULT_HERO_LINES;

  return (
    <main id="main-content" className="public-home">
      <OrganizationJsonLd
        name="Pixel&Digital"
        path="/"
        description={HOME_DESCRIPTION}
      />
      <section className="home-hero">
        <div className="home-hero__eyebrow">
          {cms.hero?.eyebrow ?? "Agence créative & digitale"}
        </div>
        <div className="home-hero__grid">
          <div className="home-hero__copy">
            <Reveal>
              <h1 className="home-hero__title">
                {heroLines[0]}
                {heroLines[1] ? <span>{heroLines[1]}</span> : null}
                {heroLines.length > 2 ? (
                  <strong>{heroLines.slice(2).join(" ")}</strong>
                ) : null}
              </h1>
            </Reveal>
            <Reveal delay={0.15}>
              <p className="home-hero__lede">
                {cms.hero?.lede ??
                  "Nous construisons des marques visibles, crédibles et difficiles à oublier de la stratégie à l’exécution."}
              </p>
            </Reveal>
            <Reveal delay={0.25}>
              <div className="home-hero__actions">
                <MagneticButton
                  href={cms.hero?.ctaHref ?? "/contact"}
                  className="button button--primary"
                >
                  {cms.hero?.ctaLabel ?? "Lancer un projet"}
                </MagneticButton>
                <Link href="#capacites" className="home-hero__secondary-link">
                  Voir nos expertises
                </Link>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <div className="home-hero__visual">
              <HeroParallax className="home-hero__parallax" strength={22}>
                {cms.hero?.imageUrl ? (
                  <Image
                    className="home-hero__photo"
                    src={cms.hero.imageUrl}
                    alt={cms.hero.imageAlt}
                    fill
                    priority
                    sizes="(max-width: 760px) 100vw, 46vw"
                  />
                ) : null}
                <div className="home-hero__orb home-hero__orb--red" />
                <div className="home-hero__orb home-hero__orb--black" />
              </HeroParallax>
              <div className="home-hero__stamp">P&D</div>
              <div className="home-hero__caption">
                Stratégie · Identité · Contenu · Digital · Production
              </div>
            </div>
          </Reveal>
        </div>
        <div className="home-hero__ticker" aria-hidden="true">
          <span>STRAT&Eacute;GIE</span>
          <span>IDENTIT&Eacute;</span>
          <span>CONTENU</span>
          <span>DIGITAL</span>
          <span>PRODUCTION</span>
        </div>
      </section>

      <section className="home-manifesto">
        <Reveal>
          <p className="home-manifesto__label">
            Notre façon de voir les choses
          </p>
          <h2 className="home-manifesto__title">
            {MANIFESTO.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h2>
        </Reveal>
      </section>

      <section id="capacites" className="home-services">
        <div className="home-section-head">
          <Reveal>
            <p className="home-section-head__kicker">
              Ce qu&rsquo;on sait faire
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="home-section-head__title">
              Une seule équipe pour faire avancer toute la marque.
            </h2>
          </Reveal>
        </div>

        {services.length === 0 ? (
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

      <section id="preuve" className="home-method">
        <div className="home-method__intro">
          <p>Une méthode simple</p>
          <h2>On pense juste. On crée fort. On exécute proprement.</h2>
        </div>
        <div className="home-method__steps">
          {["Comprendre", "Positionner", "Créer", "Déployer"].map(
            (step, index) => (
              <Reveal key={step} delay={index * 0.08}>
                <div className="home-method__step">
                  <span>0{index + 1}</span>
                  <strong>{step}</strong>
                </div>
              </Reveal>
            ),
          )}
        </div>
      </section>

      <section className="home-kwaliti">
        <div className="home-kwaliti__visual" aria-hidden="true">
          <span>K</span>
          <span>P</span>
        </div>
        <div className="home-kwaliti__content">
          <p>Notre bras production</p>
          <h2>
            Kwaliti Print transforme vos idées en objets qu&rsquo;on remarque.
          </h2>
          <MagneticButton
            href="/kwaliti-print"
            className="button button--kwaliti"
          >
            Découvrir Kwaliti Print
          </MagneticButton>
        </div>
      </section>

      <section className="home-closing">
        <Reveal>
          <p>
            {cms.closing?.kicker ??
              "Être partout ne sert à rien si personne ne se souvient de vous."}
          </p>
          <h2>
            {cms.closing?.title ??
              "Faisons quelque chose qu’on ne peut pas ignorer."}
          </h2>
          <MagneticButton
            href={cms.closing?.ctaHref ?? "/contact"}
            className="button button--primary"
          >
            {cms.closing?.ctaLabel ?? "Parler à Pixel&Digital"}
          </MagneticButton>
        </Reveal>
      </section>
    </main>
  );
}
