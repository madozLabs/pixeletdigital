import type { Clock } from "@/shared/clock";
import type { RequestOriginMetadata } from "@/shared/request-context";

import {
  CREDENTIALS_PROVIDER,
  normalizeEmail,
  type User,
} from "../domain/access";
import type {
  AuthAccountRepository,
  UserRepository,
} from "./access-repositories";
import type { AuthenticationActivityWriter } from "./authentication-activity";
import { recordAuthenticationActivity } from "./authentication-activity";
import type { PasswordHasher } from "./password-hasher";

export type VerifyCredentialsError = Readonly<{
  code: "INVALID_CREDENTIALS";
  message: string;
}>;

export type VerifyCredentialsInput = Readonly<{
  email: string;
  password: string;
  eventId: string;
  correlationId: string;
  origin: RequestOriginMetadata;
}>;

export async function verifyCredentials(
  dependencies: Readonly<{
    authAccounts: AuthAccountRepository;
    users: UserRepository;
    passwordHasher: PasswordHasher;
    authenticationActivity: AuthenticationActivityWriter;
    clock: Clock;
  }>,
  input: VerifyCredentialsInput,
): Promise<
  | Readonly<{ ok: true; value: User }>
  | Readonly<{ ok: false; error: VerifyCredentialsError }>
> {
  const normalizedEmail = normalizeEmail(input.email);
  const occurredAt = dependencies.clock.now();

  if (!normalizedEmail) {
    return fail(dependencies, input, occurredAt, "INVALID_CREDENTIALS");
  }

  const account = await dependencies.authAccounts.findByIdentity({
    provider: CREDENTIALS_PROVIDER,
    providerAccountId: normalizedEmail,
  });
  if (!account || !account.passwordHash) {
    return fail(dependencies, input, occurredAt, "UNLINKED_IDENTITY");
  }

  const passwordValid = await dependencies.passwordHasher.verify(
    input.password,
    account.passwordHash,
  );
  if (!passwordValid) {
    return fail(
      dependencies,
      input,
      occurredAt,
      "INVALID_CREDENTIALS",
      account.userId,
    );
  }

  const user = await dependencies.users.findById(account.userId);
  if (!user || user.status !== "ACTIVE") {
    return fail(
      dependencies,
      input,
      occurredAt,
      "INACTIVE_USER",
      account.userId,
    );
  }

  await recordAuthenticationActivity(dependencies.authenticationActivity, {
    id: input.eventId,
    occurredAt,
    type: "SIGN_IN_SUCCEEDED",
    userId: user.id,
    provider: CREDENTIALS_PROVIDER,
    correlationId: input.correlationId,
    origin: input.origin,
  });

  return { ok: true, value: user };
}

async function fail(
  dependencies: Readonly<{
    authenticationActivity: AuthenticationActivityWriter;
  }>,
  input: VerifyCredentialsInput,
  occurredAt: Date,
  reason: "INVALID_CREDENTIALS" | "UNLINKED_IDENTITY" | "INACTIVE_USER",
  userId?: string,
): Promise<Readonly<{ ok: false; error: VerifyCredentialsError }>> {
  await recordAuthenticationActivity(dependencies.authenticationActivity, {
    id: input.eventId,
    occurredAt,
    type: "SIGN_IN_FAILED",
    ...(userId ? { userId } : {}),
    provider: CREDENTIALS_PROVIDER,
    reason,
    correlationId: input.correlationId,
    origin: input.origin,
  });

  return {
    ok: false,
    error: {
      code: "INVALID_CREDENTIALS",
      message: "The provided email or password is incorrect.",
    },
  };
}
