from pathlib import Path

path = Path("src/app/(marketing)/[slug]/page.tsx")
text = path.read_text(encoding="utf-8")
if not text.startswith("/* eslint-disable"):
    text = "/* eslint-disable @next/next/no-img-element */\n" + text
path.write_text(text, encoding="utf-8")
