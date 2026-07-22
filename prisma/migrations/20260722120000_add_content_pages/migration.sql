CREATE TYPE "PageLifecycleState" AS ENUM (
  'DRAFT',
  'IN_REVIEW',
  'SCHEDULED',
  'PUBLISHED',
  'ARCHIVED'
);

CREATE TABLE "pages" (
  "id" TEXT NOT NULL,
  "worldKey" TEXT NOT NULL,
  "pageType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "lifecycle" "PageLifecycleState" NOT NULL,
  "version" INTEGER NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pages_worldKey_pageType_slug_key"
  ON "pages"("worldKey", "pageType", "slug");
CREATE INDEX "pages_worldKey_lifecycle_idx"
  ON "pages"("worldKey", "lifecycle");

ALTER TABLE "pages"
  ADD CONSTRAINT "pages_worldKey_fkey"
  FOREIGN KEY ("worldKey") REFERENCES "worlds"("key")
  ON DELETE RESTRICT ON UPDATE CASCADE;
