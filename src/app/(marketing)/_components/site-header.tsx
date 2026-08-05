"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { PublishedSiteIdentity } from "@/app/_lib/site-identity";

import { WorldSwitcher } from "./world-switcher";

function NavigationLinks({ identity }: { identity: PublishedSiteIdentity }) {
  const items =
    identity.navigationItems.length > 0
      ? identity.navigationItems
      : [
          { label: "Expertises", href: "/#capacites" },
          { label: "Méthode", href: "/#preuve" },
        ];
  return (
    <>
      {items.map((item) => (
        <Link key={`${item.label}-${item.href}`} href={item.href}>
          {item.label}
        </Link>
      ))}
      <WorldSwitcher />
      <Link href={identity.contactHref} className="site-header__cta">
        {identity.contactLabel}
      </Link>
    </>
  );
}

export function SiteHeader({ identity }: { identity: PublishedSiteIdentity }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 8);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className="site-header"
      data-scrolled={scrolled ? "true" : "false"}
    >
      <Link
        href="/"
        className="site-header__mark"
        aria-label={`${identity.siteName}, accueil`}
      >
        {identity.logoUrl ? (
          <Image
            className="site-header__logo"
            src={identity.logoUrl}
            alt={identity.logoAlt}
            width={180}
            height={60}
          />
        ) : (
          identity.siteName
        )}
      </Link>
      <nav className="site-header__nav" aria-label="Navigation principale">
        <NavigationLinks identity={identity} />
      </nav>
      <details className="site-header__mobile">
        <summary>
          <span>Menu</span>
        </summary>
        <nav aria-label="Navigation mobile">
          <NavigationLinks identity={identity} />
        </nav>
      </details>
    </header>
  );
}
