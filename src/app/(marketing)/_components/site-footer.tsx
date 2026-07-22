import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__row">
        <span className="site-footer__mark">Pixel&amp;Digital</span>
        <nav aria-label="Navigation de pied de page">
          <Link href="/#capacites">Ce que nous faisons</Link>
          <Link href="/#kwaliti-print">Kwaliti Print</Link>
          <Link href="/contact">Nous contacter</Link>
        </nav>
      </div>
      <p className="site-footer__legal">
        Informations légales en cours de finalisation.
      </p>
    </footer>
  );
}
