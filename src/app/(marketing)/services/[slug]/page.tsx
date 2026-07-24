import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getPublishedService } from "@/modules/content/application/public/get-published-service";
import { PrismaServiceRepository } from "@/modules/content/infrastructure/prisma-service-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";
import { Reveal } from "@/app/_components/reveal";

export const dynamic = "force-dynamic";
type PageParams = Readonly<{ params: Promise<{ slug: string }> }>;

async function loadService(slug: string) {
  return getPublishedService(
    {
      services: new PrismaServiceRepository(prisma),
      worlds: new PrismaWorldRepository(prisma),
    },
    { worldKey: "pixel-digital", slug },
  ).catch(() => null);
}

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const service = await loadService(slug);
  return service
    ? { title: service.name, description: service.description }
    : { title: "Service | Pixel&Digital" };
}
export default async function ServiceDetailPage({ params }: PageParams) {
  const { slug } = await params;
  const service = await loadService(slug);
  if (!service) notFound();

  const outcomes = [
    "Une direction claire et exploitable",
    "Des livrables pens&eacute;s pour la performance",
    "Une ex&eacute;cution coh&eacute;rente sur tous les points de contact",
  ];

  return (
    <main id="main-content" className="service-page">
      <section className="service-page__hero">
        <Reveal>
          <Link href="/#capacites" className="service-page__back">
            &larr; Retour aux expertises
          </Link>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="service-page__eyebrow">Expertise Pixel&amp;Digital</p>
          <h1>{service.name}</h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="service-page__intro">{service.description}</p>
        </Reveal>
      </section>

      <section className="service-page__promise">
        <p>Notre objectif</p>
        <h2>
          Transformer cette expertise en avantage concret pour votre marque.
        </h2>
      </section>
      <section className="service-page__outcomes">
        <div>
          <p className="service-page__eyebrow">Ce que vous obtenez</p>
          <h2>Pas du bruit. Des r&eacute;sultats utiles.</h2>
        </div>
        <ol>
          {outcomes.map((outcome, index) => (
            <li key={outcome}>
              <span>0{index + 1}</span>
              <strong>{outcome}</strong>
            </li>
          ))}
        </ol>
      </section>

      <section className="service-page__closing">
        <p>
          Votre projet m&eacute;rite mieux qu&rsquo;une solution
          g&eacute;n&eacute;rique.
        </p>
        <h2>Construisons une r&eacute;ponse qui prend terrain.</h2>
        <Link
          href={`/contact?service=${encodeURIComponent(service.slug)}`}
          className="button button--primary"
        >
          Discuter de ce service
        </Link>
      </section>
    </main>
  );
}
