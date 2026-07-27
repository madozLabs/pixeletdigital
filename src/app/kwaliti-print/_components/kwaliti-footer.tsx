import Link from "next/link";

import type { PublishedSiteIdentity } from "@/app/_lib/site-identity";
import { whatsappHref } from "@/modules/content/domain/site-identity";

export function KwalitiFooter({
  identity,
}: {
  identity: PublishedSiteIdentity;
}) {
  const whatsapp = whatsappHref(identity.whatsappNumber);
  return (
    <footer className="kp-site-footer">
      <div>
        <p className="kp-site-footer__mark">{identity.siteName}</p>
        <h2>
          {identity.footerText ||
            "Votre marque mérite mieux qu’un support qu’on oublie."}
        </h2>
      </div>
      <div className="kp-site-footer__bottom">
        <nav aria-label="Navigation de pied de page">
          {identity.footerNavigationItems.map((item) => (
            <Link key={`${item.label}-${item.href}`} href={item.href}>
              {item.label}
            </Link>
          ))}
          <Link href={identity.contactHref}>{identity.contactLabel}</Link>
          <Link href="/">Pixel&amp;Digital</Link>
          {identity.linkedinHref ? (
            <Link href={identity.linkedinHref}>LinkedIn</Link>
          ) : null}
          {identity.instagramHref ? (
            <Link href={identity.instagramHref}>Instagram</Link>
          ) : null}
          {whatsapp ? (
            <Link href={whatsapp} target="_blank" rel="noreferrer">
              WhatsApp
            </Link>
          ) : null}
          {identity.legalNoticeHref ? (
            <Link href={identity.legalNoticeHref}>Mentions légales</Link>
          ) : null}
          {identity.privacyPolicyHref ? (
            <Link href={identity.privacyPolicyHref}>Confidentialité</Link>
          ) : null}
        </nav>
        <p>{identity.address || identity.tagline}</p>
      </div>
    </footer>
  );
}
