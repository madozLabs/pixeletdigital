CREATE TYPE "EnquiryType" AS ENUM ('GENERAL');
CREATE TYPE "EnquiryAbuseStatus" AS ENUM ('ACCEPTED', 'FLAGGED');

CREATE TABLE "enquiries" (
  "id" TEXT NOT NULL,
  "type" "EnquiryType" NOT NULL,
  "worldKey" TEXT NOT NULL,
  "serviceId" TEXT,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "message" TEXT NOT NULL,
  "sourcePage" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "abuseStatus" "EnquiryAbuseStatus" NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "enquiries_idempotencyKey_key" ON "enquiries"("idempotencyKey");
CREATE INDEX "enquiries_worldKey_email_submittedAt_idx" ON "enquiries"("worldKey", "email", "submittedAt");
CREATE INDEX "enquiries_worldKey_submittedAt_idx" ON "enquiries"("worldKey", "submittedAt");

ALTER TABLE "enquiries"
  ADD CONSTRAINT "enquiries_worldKey_fkey"
  FOREIGN KEY ("worldKey") REFERENCES "worlds"("key")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "enquiries"
  ADD CONSTRAINT "enquiries_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "services"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "consent_records" (
  "id" TEXT NOT NULL,
  "enquiryId" TEXT NOT NULL,
  "purposeKey" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "response" BOOLEAN NOT NULL,
  "source" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consent_records_enquiryId_key" ON "consent_records"("enquiryId");

ALTER TABLE "consent_records"
  ADD CONSTRAINT "consent_records_enquiryId_fkey"
  FOREIGN KEY ("enquiryId") REFERENCES "enquiries"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
