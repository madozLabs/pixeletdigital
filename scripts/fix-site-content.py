from pathlib import Path

path = Path("src/app/workspace/site-content/page.tsx")
text = path.read_text(encoding="utf-8")
if not text.startswith("/* eslint-disable"):
    text = "/* eslint-disable @next/next/no-img-element */\n" + text
text = text.replace(
    'import { prisma } from "@/infrastructure/shared/prisma-client";',
    'import type { Prisma } from "@/generated/prisma/client";\nimport { prisma } from "@/infrastructure/shared/prisma-client";',
)
start = text.index("type EditablePage =")
end = text.index("\n\nfunction PageEditor", start)
text = text[:start] + "type EditablePage = Prisma.PageGetPayload<{ include: { sections: true } }>;" + text[end:]
path.write_text(text, encoding="utf-8")
