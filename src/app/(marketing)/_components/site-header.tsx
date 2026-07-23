import Link from "next/link";

import { WorldSwitcher } from "./world-switcher";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="site-header__mark">
        Pixel<span className="site-header__mark-accent">&</span>Digital
      </Link>
      <nav className="site-header__nav" aria-label="Navigation principale">
        <Link href="/#capacites">Ce que nous faisons</Link>
        <Link href="/#preuve">Méthode</Link>
        <WorldSwitcher />
        <Link href="/contact" className="site-header__cta">
          Nous contacter
        </Link>
      </nav>
    </header>
  );
}
