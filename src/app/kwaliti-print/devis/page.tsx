import type { Metadata } from "next";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getPublishedService } from "@/modules/content/application/public/get-published-service";
import { PrismaServiceRepository } from "@/modules/content/infrastructure/prisma-service-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { ContactForm } from "@/app/(marketing)/contact/contact-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demander un devis — Kwaliti Print",
  description:
    "Parlez-nous de votre projet de personnalisation ou d'impression.",
};

type PageProps = Readonly<{
  searchParams: Promise<{ service?: string }>;
}>;

export default async function KwalitiPrintDevisPage({
  searchParams,
}: PageProps) {
  const { service: serviceSlug } = await searchParams;
  const service = serviceSlug ? await loadService(serviceSlug) : null;
  const sourcePage = service
    ? `/kwaliti-print/devis?service=${service.slug}`
    : "/kwaliti-print/devis";

  return (
    <main id="main-content" className="section">
      <h1 className="section__title">Demander un devis</h1>
      <p className="section__lede">
        Parlez-nous de votre projet. Nous revenons vers vous après examen de
        votre demande.
      </p>
      {service ? (
        <p className="contact-form__context">
          Au sujet de : <strong>{service.name}</strong>
        </p>
      ) : null}
      <ContactForm
        worldKey="kwaliti-print"
        serviceSlug={service ? service.slug : null}
        sourcePage={sourcePage}
      />
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
