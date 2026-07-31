import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";

export type RecordableAuditAction =
  | "CONTENT_PAGE_PUBLISHED"
  | "CONTENT_SITE_IDENTITY_PUBLISHED"
  | "CONTENT_PAGE_ARCHIVED"
  | "CONTENT_SERVICE_PUBLISHED"
  | "CONTENT_SERVICE_ARCHIVED"
  | "BILLING_INVOICE_ISSUED"
  | "BILLING_INVOICE_CANCELLED"
  | "BILLING_PAYMENT_RECORDED"
  | "BILLING_CREDIT_NOTE_ISSUED"
  | "FINANCE_EXPENSE_RECORDED"
  | "FINANCE_EXPENSE_DELETED"
  | "FINANCE_REVENUE_RECORDED"
  | "FINANCE_REVENUE_DELETED";

export type RecordableAuditTargetType =
  | "PAGE"
  | "SITE_SETTINGS"
  | "SERVICE"
  | "INVOICE"
  | "CREDIT_NOTE"
  | "EXPENSE"
  | "REVENUE_ENTRY";

export type RecordAuditEventInput = Readonly<{
  action: RecordableAuditAction;
  targetType: RecordableAuditTargetType;
  targetId: string;
  actorId: string;
  correlationId: string;
  originChannel: "WORKSPACE" | "SYSTEM";
  worldKey?: string | null;
  occurredAt: Date;
}>;

/**
 * Best-effort, append-only audit write for content/billing mutations. A
 * failure here must never surface as if the underlying business mutation
 * failed -- unlike Access, whose role/permission changes are audited
 * atomically in the same transaction as the mutation itself (see
 * PrismaAccessAdministrationStore.commit), publish/archive/invoice actions
 * are lower-risk per DOMAIN_BOUNDARIES.md §3 ("raise an operational alert
 * with a traceable recovery path" rather than fail closed).
 */
export async function recordAuditEvent(
  client: PrismaClient,
  input: RecordAuditEventInput,
): Promise<void> {
  try {
    const world = input.worldKey
      ? await client.world.findUnique({
          where: { key: input.worldKey },
          select: { id: true },
        })
      : null;
    await client.auditEvent.create({
      data: {
        id: `audit_${randomUUID()}`,
        occurredAt: input.occurredAt,
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        result: "SUCCEEDED",
        correlationId: input.correlationId,
        originChannel: input.originChannel,
        worldId: world?.id ?? null,
      },
    });
  } catch (error) {
    console.error(
      "Failed to record audit event",
      input.action,
      input.targetId,
      error,
    );
  }
}
