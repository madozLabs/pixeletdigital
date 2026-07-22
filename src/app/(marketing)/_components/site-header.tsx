import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="site-header__mark">
        Pixel<span className="site-header__mark-accent">&</span>Digital
      </Link>
      <nav className="site-header__nav" aria-label="Navigation principale">
        <Link href="/#capacites">Ce que nous faisons</Link>
        <Link href="/#preuve">Méthode</Link>
        <Link href="/#kwaliti-print">Kwaliti Print</Link>
        <Link href="/contact" className="site-header__cta">
          Nous contacter
        </Link>
      </nav>
    </header>
  );
}
