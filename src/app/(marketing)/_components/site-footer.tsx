import Link from "next/link";

import type { PublishedSiteIdentity } from "@/app/_lib/site-identity";
import { whatsappHref } from "@/modules/content/domain/site-identity";

export function SiteFooter({ identity }: { identity: PublishedSiteIdentity }) {
  const whatsapp = whatsappHref(identity.whatsappNumber);
  return (
    <footer className="public-footer">
      <div className="public-footer__lead">
        <p>{identity.siteName}</p>
        <h2>
          {identity.footerText ||
            "Une marque qu’on remarque. Une stratégie qui rapporte."}
        </h2>
      </div>
      <div className="public-footer__bottom">
        <nav aria-label="Navigation de pied de page">
          {identity.footerNavigationItems.map((item) => (
            <Link key={`${item.label}-${item.href}`} href={item.href}>
              {item.label}
            </Link>
          ))}
          <Link href="/kwaliti-print">Kwaliti Print</Link>
          <Link href={identity.contactHref}>{identity.contactLabel}</Link>
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
        <p>{identity.address || "Ouagadougou, Burkina Faso"}</p>
      </div>
    </footer>
  );
}
