import Image from "next/image";
import Link from "next/link";

import { WorldTransitionLink } from "@/app/_components/world-transition";
import type { PublishedSiteIdentity } from "@/app/_lib/site-identity";

function NavigationLinks({ identity }: { identity: PublishedSiteIdentity }) {
  const items =
    identity.navigationItems.length > 0
      ? identity.navigationItems
      : [{ label: "Possibilités", href: "/kwaliti-print/#capacites-kp" }];
  return (
    <>
      {items.map((item) => (
        <Link key={`${item.label}-${item.href}`} href={item.href}>
          {item.label}
        </Link>
      ))}
      <WorldTransitionLink href="/" label="Pixel&Digital">
        Pixel&amp;Digital
      </WorldTransitionLink>
      <Link href={identity.contactHref} className="button button--kwaliti">
        {identity.contactLabel}
      </Link>
    </>
  );
}

export function KwalitiHeader({
  identity,
}: {
  identity: PublishedSiteIdentity;
}) {
  return (
    <header className="kp-site-header">
      <Link
        href="/kwaliti-print"
        className="kp-site-header__mark"
        aria-label={`${identity.siteName}, accueil`}
      >
        {identity.logoUrl ? (
          <Image
            className="kp-site-header__logo"
            src={identity.logoUrl}
            alt={identity.logoAlt}
            width={180}
            height={60}
          />
        ) : (
          identity.siteName
        )}
      </Link>
      <nav className="kp-site-header__nav" aria-label="Navigation principale">
        <NavigationLinks identity={identity} />
      </nav>
      <details className="kp-site-header__mobile">
        <summary>Menu</summary>
        <nav aria-label="Navigation mobile">
          <NavigationLinks identity={identity} />
        </nav>
      </details>
    </header>
  );
}
