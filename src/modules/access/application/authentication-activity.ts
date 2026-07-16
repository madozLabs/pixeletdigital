import type { PrismaClient } from "@/generated/prisma/client";
import type { RequestOriginMetadata } from "@/shared/request-context";

export const AUTHENTICATION_EVENT_TYPES = [
  "SIGN_IN_SUCCEEDED",
  "SIGN_IN_FAILED",
  "SIGN_IN_REJECTED",
  "SIGN_OUT",
] as const;

export const AUTHENTICATION_FAILURE_REASONS = [
  "INVALID_CREDENTIALS",
  "UNLINKED_IDENTITY",
  "INACTIVE_USER",
  "MISSING_ASSIGNMENT",
  "PROVIDER_ERROR",
  "SESSION_INVALID",
] as const;

export type AuthenticationEventType =
  (typeof AUTHENTICATION_EVENT_TYPES)[number];
export type AuthenticationFailureReason =
  (typeof AUTHENTICATION_FAILURE_REASONS)[number];

export type AuthenticationEvent = Readonly<{
  id: string;
  occurredAt: Date;
  type: AuthenticationEventType;
  userId?: string;
  provider?: string;
  reason?: AuthenticationFailureReason;
  correlationId: string;
  origin: RequestOriginMetadata;
}>;

export type AuthenticationActivityError = Readonly<{
  code: "VALIDATION_ERROR" | "DEPENDENCY_UNAVAILABLE";
  message: string;
}>;

export interface AuthenticationActivityWriter {
  append(event: AuthenticationEvent): Promise<void>;
}

export class PrismaAuthenticationActivityWriter implements AuthenticationActivityWriter {
  constructor(private readonly client: PrismaClient) {}

  async append(event: AuthenticationEvent): Promise<void> {
    await this.client.authenticationEvent.create({
      data: {
        id: event.id,
        occurredAt: event.occurredAt,
        type: event.type,
        userId: event.userId ?? null,
        provider: event.provider ?? null,
        reason: event.reason ?? null,
        correlationId: event.correlationId,
        originChannel: event.origin.channel,
      },
    });
  }
}

export async function recordAuthenticationActivity(
  writer: AuthenticationActivityWriter,
  raw: AuthenticationEvent,
): Promise<
  | Readonly<{ ok: true; value: undefined }>
  | Readonly<{ ok: false; error: AuthenticationActivityError }>
> {
  const event = validateAuthenticationEvent(raw);
  if (!event.ok) return event;
  try {
    await writer.append(event.value);
    return { ok: true, value: undefined };
  } catch {
    return {
      ok: false,
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "Authentication activity could not be recorded.",
      },
    };
  }
}

function validateAuthenticationEvent(raw: AuthenticationEvent) {
  const id = raw.id.trim();
  const correlationId = raw.correlationId.trim();
  const provider = raw.provider?.trim();
  const userId = raw.userId?.trim();
  const validDate =
    raw.occurredAt instanceof Date && Number.isFinite(raw.occurredAt.getTime());
  const requiresUser =
    raw.type === "SIGN_IN_SUCCEEDED" || raw.type === "SIGN_OUT";
  const requiresReason =
    raw.type === "SIGN_IN_FAILED" || raw.type === "SIGN_IN_REJECTED";
  const validOrigin =
    typeof raw.origin === "object" &&
    raw.origin !== null &&
    (raw.origin.channel === "WORKSPACE" || raw.origin.channel === "SYSTEM");

  if (
    !id ||
    id.length > 128 ||
    !correlationId ||
    correlationId.length > 128 ||
    !validDate ||
    !validOrigin ||
    !AUTHENTICATION_EVENT_TYPES.includes(raw.type) ||
    (provider !== undefined && (!provider || provider.length > 255)) ||
    (userId !== undefined && (!userId || userId.length > 128)) ||
    (requiresUser && !userId) ||
    (requiresReason && !raw.reason) ||
    (!requiresReason && raw.reason !== undefined) ||
    (raw.reason !== undefined &&
      !AUTHENTICATION_FAILURE_REASONS.includes(raw.reason))
  ) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Authentication activity is invalid.",
      },
    } as const;
  }

  return {
    ok: true,
    value: Object.freeze({
      ...raw,
      id,
      occurredAt: new Date(raw.occurredAt),
      correlationId,
      ...(provider ? { provider } : {}),
      ...(userId ? { userId } : {}),
    }),
  } as const;
}
