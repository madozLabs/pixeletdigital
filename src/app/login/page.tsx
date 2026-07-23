import { AuthError } from "next-auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";

export const metadata: Metadata = {
  title: "Connexion Workspace",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";

    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/workspace/services",
      });
    } catch (caught) {
      if (caught instanceof AuthError) {
        redirect("/login?error=1");
      }
      throw caught;
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <h1 className="login-card__title">Connexion Workspace</h1>
        {error ? (
          <p className="login-card__error" role="alert">
            Email ou mot de passe incorrect.
          </p>
        ) : null}
        <form action={login} className="contact-form">
          <label className="login-card__field">
            <span>Email</span>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
            />
          </label>
          <label className="login-card__field">
            <span>Mot de passe</span>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          <button type="submit" className="button button--primary">
            Se connecter
          </button>
        </form>
      </div>
    </main>
  );
}
