import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { resolvePrismaPoolMax } from "./prisma-pool-config";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL ?? "postgresql://localhost:5432/pixeldigital";
  const max = resolvePrismaPoolMax({
    connectionString,
    configuredMax: process.env.DATABASE_POOL_MAX,
  });

  return new PrismaClient({
    adapter: new PrismaPg(
      {
        connectionString,
        keepAlive: true,
        ...(max === undefined ? {} : { max }),
      },
      {
        onPoolError(error) {
          console.error("Prisma connection pool error", {
            name: error.name,
            message: error.message,
          });
        },
      },
    ),
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
