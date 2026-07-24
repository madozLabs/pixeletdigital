CREATE TABLE "media_assets" (
  "id" TEXT NOT NULL,
  "worldKey" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "objectPath" TEXT NOT NULL,
  "publicUrl" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "altText" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "media_assets_bucket_objectPath_key"
  ON "media_assets"("bucket", "objectPath");
CREATE INDEX "media_assets_worldKey_createdAt_idx"
  ON "media_assets"("worldKey", "createdAt");
CREATE INDEX "media_assets_worldKey_mimeType_idx"
  ON "media_assets"("worldKey", "mimeType");
ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_worldKey_fkey"
  FOREIGN KEY ("worldKey") REFERENCES "worlds"("key")
  ON DELETE RESTRICT ON UPDATE CASCADE;
