import Link from "next/link";

const NavigationLinks = () => (
  <>
    <Link href="/kwaliti-print/#capacites-kp">Possibilités</Link>
    <Link href="/">Pixel&amp;Digital</Link>
    <Link href="/kwaliti-print/devis" className="button button--kwaliti">
      Demander un devis
    </Link>
  </>
);

export function KwalitiHeader() {
  return (
    <header className="kp-site-header">
      <Link
        href="/kwaliti-print"
        className="kp-site-header__mark"
        aria-label="Kwaliti Print, accueil"
      >
        <span>kwaliti</span> print
      </Link>
      <nav className="kp-site-header__nav" aria-label="Navigation principale">
        <NavigationLinks />
      </nav>
      <details className="kp-site-header__mobile">
        <summary>Menu</summary>
        <nav aria-label="Navigation mobile">
          <NavigationLinks />
        </nav>
      </details>
    </header>
  );
}
