-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CONTENT_PAGE_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE 'CONTENT_PAGE_ARCHIVED';
ALTER TYPE "AuditAction" ADD VALUE 'CONTENT_SERVICE_PUBLISHED';
ALTER TYPE "AuditAction" ADD VALUE 'CONTENT_SERVICE_ARCHIVED';
ALTER TYPE "AuditAction" ADD VALUE 'BILLING_INVOICE_ISSUED';
ALTER TYPE "AuditAction" ADD VALUE 'BILLING_INVOICE_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'BILLING_PAYMENT_RECORDED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditTargetType" ADD VALUE 'PAGE';
ALTER TYPE "AuditTargetType" ADD VALUE 'SERVICE';
ALTER TYPE "AuditTargetType" ADD VALUE 'INVOICE';

