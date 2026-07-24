import Link from "next/link";

export function KwalitiFooter() {
  return (
    <footer className="kp-site-footer">
      <div>
        <p className="kp-site-footer__mark">kwaliti print</p>
        <h2>Votre marque mérite mieux qu’un support qu’on oublie.</h2>
      </div>
      <div className="kp-site-footer__bottom">
        <nav aria-label="Navigation de pied de page">
          <Link href="/kwaliti-print/#possibilites">Possibilités</Link>
          <Link href="/kwaliti-print/devis">Demander un devis</Link>
          <Link href="/">Pixel&amp;Digital</Link>
        </nav>
        <p>Personnalisation · Impression · Signalétique</p>
      </div>
    </footer>
  );
}
