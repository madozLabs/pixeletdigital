from pathlib import Path

path = Path("src/app/workspace/site-content/actions.ts")
text = path.read_text(encoding="utf-8")
text = text.replace(
    'import { prisma } from "@/infrastructure/shared/prisma-client";',
    'import type { Prisma } from "@/generated/prisma/client";\nimport { prisma } from "@/infrastructure/shared/prisma-client";',
)
text = text.replace("      payload,\n", "      payload: payload as Prisma.InputJsonValue,\n")
path.write_text(text, encoding="utf-8")
