CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "CatalogueItemKind" AS ENUM ('SERVICE', 'PRODUCT');
CREATE TYPE "CatalogueItemStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'CANCELLED');

CREATE TABLE "clients" (
  "id" TEXT NOT NULL,
  "worldKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "status" "ClientStatus" NOT NULL,
  "version" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "clients_worldKey_status_idx" ON "clients"("worldKey", "status");

ALTER TABLE "clients"
  ADD CONSTRAINT "clients_worldKey_fkey"
  FOREIGN KEY ("worldKey") REFERENCES "worlds"("key")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "catalogue_items" (
  "id" TEXT NOT NULL,
  "worldKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "kind" "CatalogueItemKind" NOT NULL,
  "unitPriceCents" INTEGER NOT NULL,
  "status" "CatalogueItemStatus" NOT NULL,
  "version" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "catalogue_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "catalogue_items_worldKey_status_idx" ON "catalogue_items"("worldKey", "status");

ALTER TABLE "catalogue_items"
  ADD CONSTRAINT "catalogue_items_worldKey_fkey"
  FOREIGN KEY ("worldKey") REFERENCES "worlds"("key")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "invoices" (
  "id" TEXT NOT NULL,
  "worldKey" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "status" "InvoiceStatus" NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoices_worldKey_number_key" ON "invoices"("worldKey", "number");
CREATE INDEX "invoices_worldKey_status_idx" ON "invoices"("worldKey", "status");

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_worldKey_fkey"
  FOREIGN KEY ("worldKey") REFERENCES "worlds"("key")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "invoice_lines" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPriceCents" INTEGER NOT NULL,
  "order" INTEGER NOT NULL,

  CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invoice_lines_invoiceId_order_idx" ON "invoice_lines"("invoiceId", "order");

ALTER TABLE "invoice_lines"
  ADD CONSTRAINT "invoice_lines_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
