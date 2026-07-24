ALTER TABLE "clients"
ADD COLUMN "legalName" TEXT,
ADD COLUMN "website" TEXT,
ADD COLUMN "logoUrl" TEXT,
ADD COLUMN "industry" TEXT,
ADD COLUMN "notes" TEXT,
ADD COLUMN "accountManagerId" TEXT,
ADD COLUMN "commercialOwnerId" TEXT,
ADD COLUMN "teamId" TEXT;

CREATE TABLE "client_contacts" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "clients_accountManagerId_idx" ON "clients"("accountManagerId");
CREATE INDEX "clients_commercialOwnerId_idx" ON "clients"("commercialOwnerId");
CREATE INDEX "clients_teamId_idx" ON "clients"("teamId");
CREATE INDEX "client_contacts_clientId_isPrimary_idx" ON "client_contacts"("clientId", "isPrimary");

ALTER TABLE "clients"
ADD CONSTRAINT "clients_accountManagerId_fkey"
FOREIGN KEY ("accountManagerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "clients"
ADD CONSTRAINT "clients_commercialOwnerId_fkey"
FOREIGN KEY ("commercialOwnerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "clients"
ADD CONSTRAINT "clients_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "client_contacts"
ADD CONSTRAINT "client_contacts_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;