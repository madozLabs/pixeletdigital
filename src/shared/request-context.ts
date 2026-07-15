import type { Clock } from "./clock";

export const APPROVED_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "WORLD_MANAGER",
  "EDITOR",
  "SALES",
  "CONTRIBUTOR",
  "READER",
] as const;

export type ApprovedRole = (typeof APPROVED_ROLES)[number];

export type AuthorizationScope =
  Readonly<{ type: "GLOBAL" }> | Readonly<{ type: "WORLD"; worldKey: string }>;

export type RequestActor = Readonly<{
  id: string;
  active: boolean;
  role: ApprovedRole;
  scopes: readonly AuthorizationScope[];
}>;

export type RequestOriginMetadata = Readonly<{
  channel: "WORKSPACE" | "SYSTEM";
}>;

export type RequestContext = Readonly<{
  actor: RequestActor | null;
  correlationId: string;
  clock: Clock;
  origin: RequestOriginMetadata;
}>;
