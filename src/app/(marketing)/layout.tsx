import type { ReactNode } from "react";
import type { Metadata } from "next";

import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";
import { WhatsappAction } from "@/app/_components/whatsapp-action";
import {
  getPublishedSiteIdentity,
  siteFontValue,
} from "@/app/_lib/site-identity";

export async function generateMetadata(): Promise<Metadata> {
  const identity = await getPublishedSiteIdentity(
    "pixel-digital",
    "Pixel&Digital",
  );
  return identity.faviconUrl ? { icons: { icon: identity.faviconUrl } } : {};
}

export default async function MarketingLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const identity = await getPublishedSiteIdentity(
    "pixel-digital",
    "Pixel&Digital",
  );
  return (
    <div
      className="pixel-digital-scope"
      style={
        {
          "--font-display": siteFontValue(identity.headingFont),
          "--font-body": siteFontValue(identity.bodyFont),
        } as React.CSSProperties
      }
    >
      <a href="#main-content" className="skip-link">
        Aller au contenu principal
      </a>
      <SiteHeader identity={identity} />
      {children}
      <WhatsappAction
        number={identity.whatsappNumber}
        siteName={identity.siteName}
      />
      <SiteFooter identity={identity} />
    </div>
  );
}
