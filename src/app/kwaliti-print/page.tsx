import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { listPublishedServices } from "@/modules/content/application/public/list-published-services";
import { PrismaServiceRepository } from "@/modules/content/infrastructure/prisma-service-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { Reveal } from "@/app/_components/reveal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kwaliti Print",
  description:
    "Notre unité de personnalisation et d'impression : capacités actuelles et demande de devis.",
};

export default async function KwalitiPrintHomePage() {
  const capabilities = await listPublishedServices(
    {
      services: new PrismaServiceRepository(prisma),
      worlds: new PrismaWorldRepository(prisma),
    },
    { worldKey: "kwaliti-print" },
  );

  return (
    <main id="main-content">
      <section className="hero">
        <div className="hero__content">
          <Reveal>
            <span className="kwaliti-monogram">
              <span>K</span>
              <span>w</span>
              <span>P</span>
            </span>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="hero__title">
              Personnalisation et impression, sans compromis.
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="hero__lede">
              Notre unité dédiée à l&rsquo;impression grand format, à la
              signalétique et aux objets personnalisés &mdash; pensée comme un
              univers distinct, tactile et orienté production.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <Link
              href="/kwaliti-print/devis"
              className="button button--kwaliti"
            >
              Demander un devis
            </Link>
          </Reveal>
        </div>
        <Reveal delay={0.2}>
          <div className="media-slot" aria-hidden="true">
            Photographie à venir
          </div>
        </Reveal>
      </section>

      <section className="section">
        <Reveal>
          <h2 className="section__title">Capacité actuelle</h2>
        </Reveal>
        {capabilities.length === 0 ? (
          <Reveal delay={0.1}>
            <p className="section__empty">
              Notre catalogue de capacités est en cours de publication.
            </p>
          </Reveal>
        ) : (
          <div className="capability-grid">
            {capabilities.map((capability, index) => (
              <Reveal key={capability.slug} delay={Math.min(index * 0.05, 0.4)}>
                <article className="capability-card">
                  <div className="media-slot" aria-hidden="true">
                    Photographie à venir
                  </div>
                  <div className="capability-card__body">
                    <h3 className="capability-card__title">
                      {capability.name}
                    </h3>
                    <p className="capability-card__description">
                      {capability.description}
                    </p>
                    <Link
                      href={`/kwaliti-print/devis?service=${encodeURIComponent(capability.slug)}`}
                      className="button button--kwaliti"
                    >
                      Demander un devis
                    </Link>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        )}
      </section>

      <section className="section section--inverted">
        <Reveal>
          <h2 className="section__title">Une exigence de production</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="section__lede">
            Matières, finitions et délais pensés pour des rendus fiables et
            reproductibles, du prototype à la série.
          </p>
        </Reveal>
      </section>

      <section className="section section--closing">
        <Reveal>
          <h2 className="section__title">Un projet à personnaliser ?</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <Link href="/kwaliti-print/devis" className="button button--kwaliti">
            Demander un devis
          </Link>
        </Reveal>
      </section>
    </main>
  );
}
