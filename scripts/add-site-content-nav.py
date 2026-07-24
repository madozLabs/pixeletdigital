from pathlib import Path

path = Path("src/app/workspace/_components/admin-shell.tsx")
text = path.read_text(encoding="utf-8")
needle = '  { href: "/workspace/services", label: "Services" },\n'
replacement = needle + '  { href: "/workspace/site-content", label: "Site & contenus" },\n'
if replacement not in text:
    text = text.replace(needle, replacement)
path.write_text(text, encoding="utf-8")
