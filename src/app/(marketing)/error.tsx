"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function MarketingError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main-content" className="error-page">
      <p className="error-page__eyebrow">Pixel&amp;Digital</p>
      <h1>Un instant, quelque chose n&apos;a pas fonctionné.</h1>
      <p>
        La page n&apos;a pas pu s&apos;afficher correctement. Ce n&apos;est pas
        de votre fait &mdash; réessayez, ou revenez un peu plus tard.
      </p>
      <div className="error-page__actions">
        <button
          type="button"
          className="button button--primary"
          onClick={() => reset()}
        >
          Réessayer
        </button>
        <Link className="error-page__link" href="/">
          Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
