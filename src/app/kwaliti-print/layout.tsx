import type { Metadata } from "next";
import type { ReactNode } from "react";

import { KwalitiFooter } from "./_components/kwaliti-footer";
import { KwalitiHeader } from "./_components/kwaliti-header";
import { WhatsappAction } from "@/app/_components/whatsapp-action";
import {
  getPublishedSiteIdentity,
  siteFontValue,
} from "@/app/_lib/site-identity";

export async function generateMetadata(): Promise<Metadata> {
  const identity = await getPublishedSiteIdentity(
    "kwaliti-print",
    "Kwaliti Print",
  );
  return {
    title: { absolute: identity.siteName },
    description:
      identity.tagline ||
      "Kwaliti Print transforme les identités et les idées en objets et surfaces imprimés.",
    alternates: { canonical: "/kwaliti-print" },
    icons: identity.faviconUrl ? { icon: identity.faviconUrl } : undefined,
    openGraph: {
      title: identity.siteName,
      description: identity.tagline,
      url: "/kwaliti-print",
      siteName: identity.siteName,
      type: "website",
    },
  };
}

export default async function KwalitiPrintLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const identity = await getPublishedSiteIdentity(
    "kwaliti-print",
    "Kwaliti Print",
  );
  return (
    <div
      data-brand="kwaliti-print"
      className="kwaliti-scope"
      style={
        {
          "--font-kwaliti": siteFontValue(identity.bodyFont),
          "--font-kwaliti-mono": siteFontValue(identity.headingFont),
        } as React.CSSProperties
      }
    >
      <a href="#main-content" className="skip-link">
        Aller au contenu principal
      </a>
      <KwalitiHeader identity={identity} />
      {children}
      <WhatsappAction
        number={identity.whatsappNumber}
        siteName={identity.siteName}
      />
      <KwalitiFooter identity={identity} />
    </div>
  );
}
