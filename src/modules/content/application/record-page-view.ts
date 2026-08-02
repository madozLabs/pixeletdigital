import type { PrismaClient } from "@/generated/prisma/client";

// Fire-and-forget by design: a pageview log entry must never slow down or
// break a real visitor's page render. Callers should not await this.
export function recordPageView(prisma: PrismaClient, pageId: string): void {
  prisma.pageView.create({ data: { pageId } }).catch(() => {});
}
