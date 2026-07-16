CREATE TYPE "AuthenticationEventType" AS ENUM (
  'SIGN_IN_SUCCEEDED',
  'SIGN_IN_FAILED',
  'SIGN_IN_REJECTED',
  'SIGN_OUT'
);

CREATE TYPE "AuthenticationFailureReason" AS ENUM (
  'INVALID_CREDENTIALS',
  'UNLINKED_IDENTITY',
  'INACTIVE_USER',
  'MISSING_ASSIGNMENT',
  'PROVIDER_ERROR',
  'SESSION_INVALID'
);

CREATE TABLE "authentication_events" (
  "id" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "type" "AuthenticationEventType" NOT NULL,
  "userId" TEXT,
  "provider" TEXT,
  "reason" "AuthenticationFailureReason",
  "correlationId" TEXT NOT NULL,
  "originChannel" "RequestOriginChannel" NOT NULL,
  CONSTRAINT "authentication_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "authentication_events_occurredAt_idx"
  ON "authentication_events"("occurredAt");
CREATE INDEX "authentication_events_userId_occurredAt_idx"
  ON "authentication_events"("userId", "occurredAt");
CREATE INDEX "authentication_events_type_occurredAt_idx"
  ON "authentication_events"("type", "occurredAt");
