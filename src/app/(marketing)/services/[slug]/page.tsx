import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getPublishedService } from "@/modules/content/application/public/get-published-service";
import { PrismaServiceRepository } from "@/modules/content/infrastructure/prisma-service-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { KineticHeading } from "../../_components/kinetic-heading";
import { Reveal } from "../../_components/reveal";

export const dynamic = "force-dynamic";

type PageParams = Readonly<{ params: Promise<{ slug: string }> }>;

async function loadService(slug: string) {
  return getPublishedService(
    {
      services: new PrismaServiceRepository(prisma),
      worlds: new PrismaWorldRepository(prisma),
    },
    { worldKey: "pixel-digital", slug },
  );
}

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const service = await loadService(slug);
  if (!service) return { title: "Service" };

  return {
    title: service.name,
    description: service.description,
  };
}

export default async function ServiceDetailPage({ params }: PageParams) {
  const { slug } = await params;
  const service = await loadService(slug);
  if (!service) notFound();

  return (
    <main>
      <section className="service-hero">
        <Reveal>
          <Link href="/#capacites" className="service-hero__back">
            ← Ce que nous faisons
          </Link>
        </Reveal>
        <KineticHeading text={service.name} className="service-hero__title" />
        <Reveal delay={0.3}>
          <p className="service-hero__lede">{service.description}</p>
        </Reveal>
        <Reveal delay={0.45}>
          <Link
            href={`/contact?service=${encodeURIComponent(service.slug)}`}
            className="button button--primary"
          >
            Discuter de ce service
          </Link>
        </Reveal>
      </section>
    </main>
  );
}
