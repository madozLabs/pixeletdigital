-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'BILLING_CREDIT_NOTE_ISSUED';
ALTER TYPE "AuditTargetType" ADD VALUE 'CREDIT_NOTE';
ALTER TYPE "BillingAttachmentTargetType" ADD VALUE 'CREDIT_NOTE';

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "worldKey" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "taxRateBps" INTEGER NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note_lines" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "credit_note_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_worldKey_number_key" ON "credit_notes"("worldKey", "number");
CREATE INDEX "credit_notes_invoiceId_idx" ON "credit_notes"("invoiceId");
CREATE INDEX "credit_notes_worldKey_issuedAt_idx" ON "credit_notes"("worldKey", "issuedAt");
CREATE INDEX "credit_note_lines_creditNoteId_order_idx" ON "credit_note_lines"("creditNoteId", "order");

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_worldKey_fkey" FOREIGN KEY ("worldKey") REFERENCES "worlds"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
