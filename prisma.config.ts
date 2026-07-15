import "dotenv/config";
import { defineConfig } from "prisma/config";

const schemaToolingUrl =
  process.env["DATABASE_URL"] ?? "postgresql://localhost:5432/pixeldigital";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: schemaToolingUrl,
  },
});
