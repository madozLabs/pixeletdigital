import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import {
  CREDENTIALS_PROVIDER,
  createAuthAccount,
  createRoleAssignment,
  createUser,
  normalizeEmail,
} from "@/modules/access/domain/access";
import { ScryptPasswordHasher } from "@/modules/access/infrastructure/scrypt-password-hasher";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const displayName = process.env.SUPER_ADMIN_NAME ?? "Super Admin";

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required to run the Super Admin bootstrap.",
    );
  }
  if (!email || !password) {
    throw new Error(
      "SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required to run the Super Admin bootstrap.",
    );
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error(
      `SUPER_ADMIN_EMAIL "${email}" is not a valid email address.`,
    );
  }
  if (password.length < 12) {
    throw new Error(
      "SUPER_ADMIN_PASSWORD must be at least 12 characters long.",
    );
  }

  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const existing = await client.user.findUnique({
      where: { normalizedEmail },
    });
    if (existing) {
      console.log(
        `Skipped: a user with email ${normalizedEmail} already exists (id ${existing.id}). No changes made.`,
      );
      return;
    }

    const existingSuperAdmin = await client.roleAssignment.findFirst({
      where: { role: "SUPER_ADMIN", scopeType: "GLOBAL" },
    });
    if (existingSuperAdmin) {
      console.log(
        "Skipped: a global Super Admin assignment already exists. No changes made. " +
          "Use the Workspace administration flow to provision additional employees.",
      );
      return;
    }

    const now = new Date();
    const userId = `user_${randomUUID()}`;
    const authAccountId = `auth_account_${randomUUID()}`;
    const assignmentId = `role_assignment_${randomUUID()}`;

    const userResult = createUser({
      id: userId,
      displayName,
      normalizedEmail,
      status: "ACTIVE",
    });
    if (!userResult.ok) throw new Error(userResult.error.message);

    const hasher = new ScryptPasswordHasher();
    const passwordHash = await hasher.hash(password);
    const authAccountResult = createAuthAccount({
      id: authAccountId,
      userId,
      provider: CREDENTIALS_PROVIDER,
      providerAccountId: normalizedEmail,
      passwordHash,
    });
    if (!authAccountResult.ok) throw new Error(authAccountResult.error.message);

    const assignmentResult = createRoleAssignment({
      id: assignmentId,
      userId,
      role: "SUPER_ADMIN",
      scope: { type: "GLOBAL" },
      validFrom: now,
    });
    if (!assignmentResult.ok) throw new Error(assignmentResult.error.message);

    await client.$transaction([
      client.user.create({ data: userResult.value }),
      client.authAccount.create({ data: authAccountResult.value }),
      client.roleAssignment.create({
        data: {
          id: assignmentResult.value.id,
          userId: assignmentResult.value.userId,
          role: assignmentResult.value.role,
          scopeType: assignmentResult.value.scope.type,
          validFrom: assignmentResult.value.validFrom,
        },
      }),
      client.auditEvent.create({
        data: {
          id: `audit_${randomUUID()}`,
          occurredAt: now,
          actorId: "system-bootstrap",
          action: "ACCESS_USER_CREATED",
          targetType: "USER",
          targetId: userId,
          result: "SUCCEEDED",
          correlationId: "seed-super-admin",
          originChannel: "SYSTEM",
        },
      }),
    ]);

    console.log(
      `Super Admin created: ${normalizedEmail} (user ${userId}). Sign in at the Workspace login with this email and the configured password.`,
    );
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
