CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT','SENT','ACCEPTED','DECLINED','EXPIRED','CONVERTED','CANCELLED');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH','BANK_TRANSFER','MOBILE_MONEY','CARD','CHEQUE','OTHER');
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'OVERDUE';

CREATE TABLE "quotes" (
  "id" TEXT NOT NULL,
  "worldKey" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3),
  "discountCents" INTEGER NOT NULL DEFAULT 0,
  "taxRateBps" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "convertedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "quote_lines" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPriceCents" INTEGER NOT NULL,
  "order" INTEGER NOT NULL,
  CONSTRAINT "quote_lines_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "invoices" ADD COLUMN "quoteId" TEXT;
ALTER TABLE "invoices" ADD COLUMN "dueAt" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "taxRateBps" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN "notes" TEXT;
ALTER TABLE "invoices" ADD COLUMN "paidAt" TIMESTAMP(3);

CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reference" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "quotes_worldKey_number_key" ON "quotes"("worldKey","number");
CREATE INDEX "quotes_worldKey_status_idx" ON "quotes"("worldKey","status");
CREATE INDEX "quotes_clientId_status_idx" ON "quotes"("clientId","status");
CREATE INDEX "quote_lines_quoteId_order_idx" ON "quote_lines"("quoteId","order");
CREATE UNIQUE INDEX "invoices_quoteId_key" ON "invoices"("quoteId");
CREATE INDEX "invoices_clientId_status_idx" ON "invoices"("clientId","status");
CREATE INDEX "invoices_dueAt_idx" ON "invoices"("dueAt");
CREATE INDEX "payments_invoiceId_paidAt_idx" ON "payments"("invoiceId","paidAt");
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_worldKey_fkey" FOREIGN KEY ("worldKey") REFERENCES "worlds"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
