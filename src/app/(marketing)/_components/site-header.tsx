import Link from "next/link";

import { WorldSwitcher } from "./world-switcher";

const NavigationLinks = () => (
  <>
    <Link href="/#capacites">Expertises</Link>
    <Link href="/#preuve">M&eacute;thode</Link>
    <WorldSwitcher />
    <Link href="/contact" className="site-header__cta">
      Lancer un projet
    </Link>
  </>
);

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link
        href="/"
        className="site-header__mark"
        aria-label="Pixel and Digital, accueil"
      >
        Pixel<span className="site-header__mark-accent">&amp;</span>Digital
      </Link>
      <nav className="site-header__nav" aria-label="Navigation principale">
        <NavigationLinks />
      </nav>
      <details className="site-header__mobile">
        <summary>Menu</summary>
        <nav aria-label="Navigation mobile">
          <NavigationLinks />
        </nav>
      </details>
    </header>
  );
}
