-- CreateEnum
CREATE TYPE "ExpenseCategoryStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'FINANCE_EXPENSE_RECORDED';
ALTER TYPE "AuditAction" ADD VALUE 'FINANCE_EXPENSE_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'FINANCE_REVENUE_RECORDED';
ALTER TYPE "AuditAction" ADD VALUE 'FINANCE_REVENUE_DELETED';
ALTER TYPE "AuditTargetType" ADD VALUE 'EXPENSE';
ALTER TYPE "AuditTargetType" ADD VALUE 'REVENUE_ENTRY';

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "ExpenseCategoryStatus" NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "worldKey" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_entries" (
    "id" TEXT NOT NULL,
    "worldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "revenueDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_label_key" ON "expense_categories"("label");
CREATE INDEX "expenses_worldKey_expenseDate_idx" ON "expenses"("worldKey", "expenseDate");
CREATE INDEX "expenses_categoryId_idx" ON "expenses"("categoryId");
CREATE INDEX "revenue_entries_worldKey_revenueDate_idx" ON "revenue_entries"("worldKey", "revenueDate");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_worldKey_fkey" FOREIGN KEY ("worldKey") REFERENCES "worlds"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_worldKey_fkey" FOREIGN KEY ("worldKey") REFERENCES "worlds"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "revenue_entries" ADD CONSTRAINT "revenue_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
