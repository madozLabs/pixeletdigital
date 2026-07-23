import Link from "next/link";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { listPublishedServices } from "@/modules/content/application/public/list-published-services";
import { PrismaServiceRepository } from "@/modules/content/infrastructure/prisma-service-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { KineticHeading } from "@/app/_components/kinetic-heading";
import { Reveal } from "@/app/_components/reveal";

const TAGLINE =
  "Nous créons des marques qui attirent, convainquent et restent en mémoire.";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const services = await listPublishedServices(
    {
      services: new PrismaServiceRepository(prisma),
      worlds: new PrismaWorldRepository(prisma),
    },
    { worldKey: "pixel-digital" },
  );

  return (
    <main id="main-content">
      <section className="hero">
        <div className="hero__content">
          <KineticHeading text={TAGLINE} className="hero__title" />
          <Reveal delay={0.5}>
            <p className="hero__lede">
              Studio créatif spécialisé dans la communication visuelle, le
              marketing digital, la création de contenus, l&rsquo;audiovisuel,
              le développement web et les solutions d&rsquo;impression à travers
              notre marque Kwaliti Print.
            </p>
          </Reveal>
          <Reveal delay={0.65}>
            <Link href="/contact" className="button button--primary">
              Discuter de votre projet
            </Link>
          </Reveal>
        </div>
        <Reveal delay={0.3}>
          <div className="media-slot" aria-hidden="true">
            Photographie à venir
          </div>
        </Reveal>
      </section>

      <section id="capacites" className="section">
        <Reveal>
          <h2 className="section__title">Ce que nous faisons</h2>
        </Reveal>
        {services.length === 0 ? (
          <Reveal delay={0.1}>
            <p className="section__empty">
              Notre catalogue de services est en cours de publication.
            </p>
          </Reveal>
        ) : (
          <ul className="service-grid">
            {services.map((service, index) => (
              <Reveal
                as="li"
                key={service.name}
                delay={Math.min(index * 0.05, 0.4)}
              >
                <Link
                  href={`/services/${service.slug}`}
                  className="service-card"
                >
                  <h3>{service.name}</h3>
                </Link>
              </Reveal>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <Reveal>
          <h2 className="section__title">Preuves &amp; résultats</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="section__lede">
            Études de cas et résultats mesurables en cours de constitution.
          </p>
        </Reveal>
        <div className="proof-grid">
          {[0, 1, 2].map((index) => (
            <Reveal key={index} delay={0.1 + index * 0.05}>
              <div className="proof-card">
                <div className="media-slot" aria-hidden="true">
                  Étude de cas à venir
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="preuve" className="section section--inverted">
        <Reveal>
          <h2 className="section__title">Une équipe, une capacité intégrée</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="section__lede">
            Stratégie, création, technologie et production avancent ensemble,
            sous une même responsabilité, du premier brief à la mise en
            production.
          </p>
        </Reveal>
      </section>

      <section
        id="kwaliti-print"
        className="section section--kwaliti kwaliti-panel"
      >
        <Reveal>
          <div className="media-slot" aria-hidden="true">
            Photographie matière/produit à venir
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="kwaliti-panel__content">
            <h2 className="section__title kwaliti-panel__title">
              Kwaliti Print
            </h2>
            <p className="section__lede">
              Notre unité de personnalisation et d&rsquo;impression, pensée
              comme un univers distinct, tactile et orienté production.
            </p>
            <Link href="/kwaliti-print" className="button button--kwaliti">
              Découvrir Kwaliti Print
            </Link>
          </div>
        </Reveal>
      </section>

      <section className="section">
        <Reveal>
          <h2 className="section__title">Studio &amp; Formation</h2>
        </Reveal>
        <div className="teaser-grid">
          <Reveal delay={0.1}>
            <article className="teaser-card">
              <h3>Studio audiovisuel</h3>
              <p>Nom et identité définitifs en cours d&rsquo;arbitrage.</p>
            </article>
          </Reveal>
          <Reveal delay={0.2}>
            <article className="teaser-card">
              <h3>Formation</h3>
              <p>Nom et identité définitifs en cours d&rsquo;arbitrage.</p>
            </article>
          </Reveal>
        </div>
      </section>

      <section className="section section--closing">
        <Reveal>
          <h2 className="section__title">Un projet en tête ?</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <Link href="/contact" className="button button--primary">
            Discuter de votre projet
          </Link>
        </Reveal>
      </section>
    </main>
  );
}
