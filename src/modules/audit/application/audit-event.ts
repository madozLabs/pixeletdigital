import type { RequestOriginMetadata } from "@/shared/request-context";

export const ACCESS_AUDIT_ACTIONS = [
  "ACCESS_USER_CREATED",
  "ACCESS_USER_ACTIVATED",
  "ACCESS_USER_DEACTIVATED",
  "ACCESS_ROLE_ASSIGNED",
  "ACCESS_ROLE_REVOKED",
] as const;

export type AccessAuditAction = (typeof ACCESS_AUDIT_ACTIONS)[number];

export type AuditEvent = Readonly<{
  id: string;
  occurredAt: Date;
  actorId: string;
  action: AccessAuditAction;
  targetType: "USER" | "ROLE_ASSIGNMENT";
  targetId: string;
  result: "SUCCEEDED";
  correlationId: string;
  origin: RequestOriginMetadata;
  worldKey?: string;
}>;
