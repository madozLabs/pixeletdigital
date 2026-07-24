import type { Metadata } from "next";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getPublishedService } from "@/modules/content/application/public/get-published-service";
import { PrismaServiceRepository } from "@/modules/content/infrastructure/prisma-service-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { ContactForm } from "@/app/(marketing)/contact/contact-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demander un devis",
  description:
    "Décrivez votre besoin d’impression ou de personnalisation à Kwaliti Print.",
};

type PageProps = Readonly<{
  searchParams: Promise<{ service?: string }>;
}>;

export default async function KwalitiPrintDevisPage({
  searchParams,
}: PageProps) {
  const { service: serviceSlug } = await searchParams;
  const service = serviceSlug
    ? await loadService(serviceSlug).catch(() => null)
    : null;
  const sourcePage = service
    ? `/kwaliti-print/devis?service=${service.slug}`
    : "/kwaliti-print/devis";

  return (
    <main id="main-content" className="kp-quote-page">
      <section className="kp-quote-page__intro">
        <p className="kp-quote-page__eyebrow">Demande de devis</p>
        <h1>Parlez-nous du support. On s’occupe de le rendre remarquable.</h1>
        <p>
          Quantité, format, matière, délai, finition : donnez-nous les éléments
          disponibles. Nous vous aidons à cadrer le reste.
        </p>
        <div className="kp-quote-page__facts">
          <span>Réponse humaine</span>
          <span>Conseil sur le support</span>
          <span>Devis adapté au besoin</span>
        </div>
      </section>

      <section className="kp-quote-page__form-panel">
        <div className="kp-quote-page__form-heading">
          <p>Votre besoin</p>
          <h2>Décrivez le projet.</h2>
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
