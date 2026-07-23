import Link from "next/link";

export function KwalitiFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__row">
        <span className="site-footer__mark">kwaliti print</span>
        <nav aria-label="Navigation de pied de page">
          <Link href="/">Pixel&amp;Digital</Link>
          <Link href="/kwaliti-print/devis">Demander un devis</Link>
        </nav>
      </div>
      <p className="site-footer__legal">
        Informations légales en cours de finalisation.
      </p>
    </footer>
  );
}
