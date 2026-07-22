import "server-only";

import { randomUUID } from "node:crypto";

import { auth } from "@/auth";
import { prisma } from "@/infrastructure/shared/prisma-client";
import { resolveAuthSessionRequestContext } from "@/modules/access/application/resolve-auth-session-request-context";
import {
  PrismaRoleAssignmentRepository,
  PrismaUserRepository,
} from "@/modules/access/infrastructure/prisma-access-repositories";
import type { RequestContext } from "@/shared/request-context";

export async function getWorkspaceRequestContext(): Promise<RequestContext | null> {
  const session = await auth();
  if (!session) return null;

  const result = await resolveAuthSessionRequestContext(
    {
      users: new PrismaUserRepository(prisma),
      roleAssignments: new PrismaRoleAssignmentRepository(prisma),
      clock: { now: () => new Date() },
    },
    {
      session,
      correlationId: randomUUID(),
      origin: { channel: "WORKSPACE" },
    },
  );

  return result.ok ? result.value : null;
}
