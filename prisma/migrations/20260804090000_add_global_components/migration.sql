-- CreateTable
CREATE TABLE "global_components" (
    "id" TEXT NOT NULL,
    "worldKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sectionType" TEXT NOT NULL,
    "sourceSectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_components_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "global_components_sourceSectionId_key" ON "global_components"("sourceSectionId");

-- CreateIndex
CREATE UNIQUE INDEX "global_components_worldKey_name_key" ON "global_components"("worldKey", "name");

-- AlterTable
ALTER TABLE "page_revision_sections" ADD COLUMN     "globalComponentId" TEXT;

-- CreateIndex
CREATE INDEX "page_revision_sections_globalComponentId_idx" ON "page_revision_sections"("globalComponentId");

-- AddForeignKey
ALTER TABLE "global_components" ADD CONSTRAINT "global_components_worldKey_fkey" FOREIGN KEY ("worldKey") REFERENCES "worlds"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_components" ADD CONSTRAINT "global_components_sourceSectionId_fkey" FOREIGN KEY ("sourceSectionId") REFERENCES "page_revision_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_revision_sections" ADD CONSTRAINT "page_revision_sections_globalComponentId_fkey" FOREIGN KEY ("globalComponentId") REFERENCES "global_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
