-- CreateTable
CREATE TABLE "page_templates" (
    "id" TEXT NOT NULL,
    "worldKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "page_templates_worldKey_name_key" ON "page_templates"("worldKey", "name");

-- AddForeignKey
ALTER TABLE "page_templates" ADD CONSTRAINT "page_templates_worldKey_fkey" FOREIGN KEY ("worldKey") REFERENCES "worlds"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
