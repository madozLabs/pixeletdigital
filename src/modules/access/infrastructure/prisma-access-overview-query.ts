import type { PrismaClient } from "@/generated/prisma/client";
import type { AccessReadModel } from "../application/access-read-model";

export class PrismaAccessReadModel implements AccessReadModel {
  constructor(private readonly database: PrismaClient) {}

  async listOverview(input: Readonly<{ skip: number; take: number }>) {
    const [users, totalUsers] = await Promise.all([
      this.database.user.findMany({
        include: {
          roleAssignments: {
            include: { world: { select: { displayName: true, key: true } } },
            orderBy: { validFrom: "desc" },
          },
        },
        orderBy: [{ status: "asc" }, { displayName: "asc" }],
        skip: input.skip,
        take: input.take,
      }),
      this.database.user.count(),
    ]);
    return { users, totalUsers };
  }

  async listActiveUserOptions() {
    return this.database.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, displayName: true, normalizedEmail: true },
      orderBy: { displayName: "asc" },
    });
  }
}
