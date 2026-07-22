import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";

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
    <main>
      <h1>Connexion Workspace</h1>
      {error ? <p role="alert">Email ou mot de passe incorrect.</p> : null}
      <form action={login}>
        <p>
          <label htmlFor="email">Email</label>
          <br />
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        </p>
        <p>
          <label htmlFor="password">Mot de passe</label>
          <br />
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </p>
        <button type="submit">Se connecter</button>
      </form>
    </main>
  );
}
