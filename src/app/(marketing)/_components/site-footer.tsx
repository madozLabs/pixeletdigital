import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="public-footer">
      <div className="public-footer__lead">
        <p>Pixel&amp;Digital</p>
        <h2>Une marque qu’on remarque. Une stratégie qui rapporte.</h2>
      </div>
      <div className="public-footer__bottom">
        <nav aria-label="Navigation de pied de page">
          <Link href="/#capacites">Expertises</Link>
          <Link href="/#preuve">Méthode</Link>
          <Link href="/kwaliti-print">Kwaliti Print</Link>
          <Link href="/contact">Lancer un projet</Link>
        </nav>
        <p>Ouagadougou · Afrique de l’Ouest &amp; au-delà</p>
      </div>
    </footer>
  );
}
