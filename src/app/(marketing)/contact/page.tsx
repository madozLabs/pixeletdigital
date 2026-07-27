import type { Metadata } from "next";

import { getCmsFormPageContent } from "@/app/_lib/cms-form-page";
import { prisma } from "@/infrastructure/shared/prisma-client";
import { getPublishedService } from "@/modules/content/application/public/get-published-service";
import { PrismaServiceRepository } from "@/modules/content/infrastructure/prisma-service-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";
import { ContactForm } from "./contact-form";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const { preview } = await searchParams;
  return {
    title: "Lancer un projet | Pixel&Digital",
    description:
      "Parlez-nous de votre projet, de votre ambition et du terrain que vous voulez prendre.",
    robots: preview ? { index: false, follow: false } : undefined,
  };
}

type PageProps = Readonly<{
  searchParams: Promise<{ service?: string; preview?: string }>;
}>;

async function loadService(slug: string) {
  return getPublishedService(
    {
      services: new PrismaServiceRepository(prisma),
      worlds: new PrismaWorldRepository(prisma),
    },
    { worldKey: "pixel-digital", slug },
  ).catch(() => null);
}

export default async function ContactPage({ searchParams }: PageProps) {
  const { service: serviceSlug, preview } = await searchParams;
  const [service, content] = await Promise.all([
    serviceSlug ? loadService(serviceSlug) : null,
    getCmsFormPageContent("pixel-digital", "contact", preview),
  ]);
  const sourcePage = service ? `/contact?service=${service.slug}` : "/contact";

  return (
    <main id="main-content" className="contact-page">
      {content.isPreview ? (
        <aside className="cms-preview-banner">
          Aperçu privé · aucune modification n’est encore publique
        </aside>
      ) : null}
      <section className="contact-page__intro">
        <p className="contact-page__eyebrow">
          {content.eyebrow ?? "On parle de votre projet ?"}
        </p>
        <h1>
          {content.title ??
            "Vous avez le terrain. Nous apportons la stratégie et la force d’exécution."}
        </h1>
        <p>
          {content.text ??
            "Dites-nous où vous en êtes, ce que vous voulez changer et ce que le projet doit produire concrètement."}
        </p>
        <div className="contact-page__facts">
          {(content.facts.length
            ? content.facts
            : [
                "Réponse humaine",
                "Brief confidentiel",
                "Projet cadré avant production",
              ]
          ).map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </div>
      </section>

      <section className="contact-page__form-panel">
        <div className="contact-page__form-heading">
          <span>01</span>
          <div>
            <p>{content.formEyebrow ?? "Votre brief"}</p>
            <h2>{content.formTitle ?? "Parlons concret."}</h2>
          </div>
        </div>
        {service ? (
          <p className="contact-form__context">
            Expertise concernée : <strong>{service.name}</strong>
          </p>
        ) : null}
        <ContactForm
          serviceSlug={service ? service.slug : null}
          sourcePage={sourcePage}
        />
      </section>
    </main>
  );
}
