import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { listPublishedServiceFamilies } from "@/modules/content/application/public/list-published-service-families";
import { listPublishedServices } from "@/modules/content/application/public/list-published-services";
import { PrismaServiceFamilyRepository } from "@/modules/content/infrastructure/prisma-service-family-repository";
import { PrismaServiceRepository } from "@/modules/content/infrastructure/prisma-service-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { Reveal } from "@/app/_components/reveal";
import { groupServicesByFamily } from "@/app/_lib/group-services-by-family";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "Impression, personnalisation et signalétique pour donner une présence physique à vos idées.",
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

  const [capabilities, families] = await Promise.all([
    listPublishedServices(deps, { worldKey: "kwaliti-print" }).catch(() => []),
    listPublishedServiceFamilies(deps, { worldKey: "kwaliti-print" }).catch(
      () => [],
    ),
  ]);
  const groups = groupServicesByFamily(capabilities, families);

  return (
    <main id="main-content" className="kp-home">
      <section className="kp-hero">
        <div className="kp-hero__copy">
          <Reveal>
            <p className="kp-eyebrow">
              Impression · Personnalisation · Production
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h1>Vos idées méritent de sortir de l’écran.</h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="kp-hero__lede">
              Kwaliti Print transforme vos visuels en supports concrets,
              visibles et bien finis — du prototype à la série.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="kp-hero__actions">
              <Link
                href="/kwaliti-print/devis"
                className="button button--kwaliti"
              >
                Demander un devis
              </Link>
              <a href="#capacites-kp" className="kp-text-link">
                Voir les possibilités
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.12}>
          <div className="kp-hero__visual" aria-hidden="true">
            <span className="kp-shape kp-shape--cyan" />
            <span className="kp-shape kp-shape--yellow" />
            <span className="kp-shape kp-shape--magenta" />
            <strong>KP</strong>
          </div>
        </Reveal>
      </section>
      <section className="kp-strip" aria-label="Catégories principales">
        {DEFAULT_CAPABILITIES.map((item) => (
          <span key={item}>{item}</span>
        ))}
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
        <p>Un besoin précis ou juste une idée ?</p>
        <h2>On vous aide à choisir la bonne manière de l’imprimer.</h2>
        <Link href="/kwaliti-print/devis" className="button button--kwaliti">
          Obtenir un devis
        </Link>
      </section>
    </main>
  );
}
