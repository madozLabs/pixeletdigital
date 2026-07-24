import type { Metadata } from "next";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { getPublishedService } from "@/modules/content/application/public/get-published-service";
import { PrismaServiceRepository } from "@/modules/content/infrastructure/prisma-service-repository";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";
import { ContactForm } from "./contact-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Lancer un projet | Pixel&Digital",
  description:
    "Parlez-nous de votre projet, de votre ambition et du terrain que vous voulez prendre.",
};

type PageProps = Readonly<{ searchParams: Promise<{ service?: string }> }>;

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
  const { service: serviceSlug } = await searchParams;
  const service = serviceSlug ? await loadService(serviceSlug) : null;
  const sourcePage = service ? `/contact?service=${service.slug}` : "/contact";
  return (
    <main id="main-content" className="contact-page">
      <section className="contact-page__intro">
        <p className="contact-page__eyebrow">On parle de votre projet ?</p>
        <h1>
          Vous avez le terrain. Nous apportons la strat&eacute;gie et la force
          d&rsquo;ex&eacute;cution.
        </h1>
        <p>
          Dites-nous o&ugrave; vous en &ecirc;tes, ce que vous voulez changer et
          ce que le projet doit produire concr&egrave;tement.
        </p>
        <div className="contact-page__facts">
          <span>R&eacute;ponse humaine</span>
          <span>Brief confidentiel</span>
          <span>Projet cadr&eacute; avant production</span>
        </div>
      </section>

      <section className="contact-page__form-panel">
        <div className="contact-page__form-heading">
          <span>01</span>
          <div>
            <p>Votre brief</p>
            <h2>Parlons concret.</h2>
          </div>
        </div>
        {service ? (
          <p className="contact-form__context">
            Expertise concern&eacute;e : <strong>{service.name}</strong>
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
