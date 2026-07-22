import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — Pixel&Digital",
};

export default function ContactPage() {
  return (
    <main className="section">
      <h1 className="section__title">Nous contacter</h1>
      <p className="section__lede">
        Notre formulaire de demande de devis est en cours de mise en place.
      </p>
      <p className="section__note">
        Revenez bientôt, ou repassez par l&rsquo;accueil pour découvrir nos
        services.
      </p>
    </main>
  );
}
