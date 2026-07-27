import type { Metadata } from "next";

import { getCmsFormPageContent } from "@/app/_lib/cms-form-page";
import { ContactForm } from "@/app/(marketing)/contact/contact-form";
import { prisma } from "@/infrastructure/shared/prisma-client";
import { getPublishedService } from "@/modules/content/application/public/get-published-service";
import { PrismaServiceRepository } from "@/modules/content/infrastructure/prisma-service-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const { preview } = await searchParams;
  return {
    title: "Demander un devis",
    description:
      "Décrivez votre besoin d’impression ou de personnalisation à Kwaliti Print.",
    robots: preview ? { index: false, follow: false } : undefined,
  };
}

type PageProps = Readonly<{
  searchParams: Promise<{ service?: string; preview?: string }>;
}>;

export default async function KwalitiPrintDevisPage({
  searchParams,
}: PageProps) {
  const { service: serviceSlug, preview } = await searchParams;
  const [service, content] = await Promise.all([
    serviceSlug ? loadService(serviceSlug).catch(() => null) : null,
    getCmsFormPageContent("kwaliti-print", "devis", preview),
  ]);
  const sourcePage = service
    ? `/kwaliti-print/devis?service=${service.slug}`
    : "/kwaliti-print/devis";

  return (
    <main id="main-content" className="kp-quote-page">
      {content.isPreview ? (
        <aside className="cms-preview-banner">
          Aperçu privé · aucune modification n’est encore publique
        </aside>
      ) : null}
      <section className="kp-quote-page__intro">
        <p className="kp-quote-page__eyebrow">
          {content.eyebrow ?? "Demande de devis"}
        </p>
        <h1>
          {content.title ??
            "Parlez-nous du support. On s’occupe de le rendre remarquable."}
        </h1>
        <p>
          {content.text ??
            "Quantité, format, matière, délai, finition : donnez-nous les éléments disponibles. Nous vous aidons à cadrer le reste."}
        </p>
        <div className="kp-quote-page__facts">
          {(content.facts.length
            ? content.facts
            : [
                "Réponse humaine",
                "Conseil sur le support",
                "Devis adapté au besoin",
              ]
          ).map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </div>
      </section>

      <section className="kp-quote-page__form-panel">
        <div className="kp-quote-page__form-heading">
          <p>{content.formEyebrow ?? "Votre besoin"}</p>
          <h2>{content.formTitle ?? "Décrivez le projet."}</h2>
          {service ? (
            <span>
              Service sélectionné : <strong>{service.name}</strong>
            </span>
          ) : null}
        </div>
        <ContactForm
          worldKey="kwaliti-print"
          serviceSlug={service ? service.slug : null}
          sourcePage={sourcePage}
          submitLabel="Recevoir mon devis"
        />
      </section>
    </main>
  );
}

async function loadService(slug: string) {
  return getPublishedService(
    {
      services: new PrismaServiceRepository(prisma),
      worlds: new PrismaWorldRepository(prisma),
    },
    { worldKey: "kwaliti-print", slug },
  );
}
