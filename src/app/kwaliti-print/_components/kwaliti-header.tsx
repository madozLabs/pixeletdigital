import Link from "next/link";

export function KwalitiHeader() {
  return (
    <header className="site-header">
      <Link href="/kwaliti-print" className="site-header__mark">
        kwaliti <span className="site-header__mark-accent">print</span>
      </Link>
      <nav className="site-header__nav" aria-label="Navigation principale">
        <Link href="/">Pixel&amp;Digital</Link>
        <Link href="/kwaliti-print/devis" className="site-header__cta">
          Demander un devis
        </Link>
      </nav>
    </header>
  );
}
