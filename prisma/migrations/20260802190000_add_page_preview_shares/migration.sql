-- CreateTable
CREATE TABLE "page_preview_shares" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "label" TEXT,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "page_preview_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "page_preview_shares_token_key" ON "page_preview_shares"("token");

-- CreateIndex
CREATE INDEX "page_preview_shares_pageId_idx" ON "page_preview_shares"("pageId");

-- AddForeignKey
ALTER TABLE "page_preview_shares" ADD CONSTRAINT "page_preview_shares_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
