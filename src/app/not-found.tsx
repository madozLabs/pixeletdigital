import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="not-found-page">
      <p className="not-found-page__code">404</p>
      <h1>Cette page n’a pas pris terrain.</h1>
      <p>
        Le lien est peut-être ancien, incomplet ou la page a changé d’adresse.
      </p>
      <div className="not-found-page__actions">
        <Link href="/" className="button button--primary">
          Retour à l’accueil
        </Link>
        <Link href="/contact" className="not-found-page__link">
          Lancer un projet
        </Link>
      </div>
    </main>
  );
}
