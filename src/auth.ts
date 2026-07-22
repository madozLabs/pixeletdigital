import { randomUUID } from "node:crypto";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "@/infrastructure/shared/prisma-client";
import { PrismaAuthenticationActivityWriter } from "@/modules/access/application/authentication-activity";
import { verifyCredentials } from "@/modules/access/application/verify-credentials";
import {
  PrismaAuthAccountRepository,
  PrismaUserRepository,
} from "@/modules/access/infrastructure/prisma-access-repositories";
import { ScryptPasswordHasher } from "@/modules/access/infrastructure/scrypt-password-hasher";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: async (credentials) => {
        const email =
          typeof credentials?.email === "string" ? credentials.email : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const result = await verifyCredentials(
          {
            authAccounts: new PrismaAuthAccountRepository(prisma),
            users: new PrismaUserRepository(prisma),
            passwordHasher: new ScryptPasswordHasher(),
            authenticationActivity: new PrismaAuthenticationActivityWriter(
              prisma,
            ),
            clock: { now: () => new Date() },
          },
          {
            email,
            password,
            eventId: randomUUID(),
            correlationId: randomUUID(),
            origin: { channel: "WORKSPACE" },
          },
        );

        if (!result.ok) return null;
        return {
          id: result.value.id,
          name: result.value.displayName,
          email: result.value.normalizedEmail,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session: async ({ session, token }) => {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
