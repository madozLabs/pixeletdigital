from pathlib import Path

path = Path("prisma/schema.prisma")
text = path.read_text(encoding="utf-8")
if "mediaAssets     MediaAsset[]" not in text:
    text = text.replace("  invoices        Invoice[]\n", "  invoices        Invoice[]\n  mediaAssets     MediaAsset[]\n")
if "model MediaAsset" not in text:
    model = '''model MediaAsset {
  id          String   @id @default(cuid())
  worldKey    String
  world       World    @relation(fields: [worldKey], references: [key], onDelete: Restrict)
  bucket      String
  objectPath  String
  publicUrl   String
  title       String
  altText     String
  mimeType    String
  sizeBytes   Int
  width       Int?
  height      Int?
  tags        String[] @default([])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([bucket, objectPath])
  @@index([worldKey, createdAt])
  @@index([worldKey, mimeType])
  @@map("media_assets")
}

'''
    text = text.replace("model Service {", model + "model Service {")
path.write_text(text, encoding="utf-8")
