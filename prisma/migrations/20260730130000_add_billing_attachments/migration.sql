-- CreateEnum
CREATE TYPE "BillingAttachmentTargetType" AS ENUM ('QUOTE', 'INVOICE');

-- CreateTable
CREATE TABLE "billing_attachments" (
    "id" TEXT NOT NULL,
    "worldKey" TEXT NOT NULL,
    "targetType" "BillingAttachmentTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectPath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_attachments_targetType_targetId_idx" ON "billing_attachments"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "billing_attachments" ADD CONSTRAINT "billing_attachments_worldKey_fkey" FOREIGN KEY ("worldKey") REFERENCES "worlds"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_attachments" ADD CONSTRAINT "billing_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
