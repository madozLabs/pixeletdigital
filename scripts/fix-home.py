from pathlib import Path
p = Path(r'src/app/(marketing)/page.tsx')
s = p.read_text(encoding='utf-8')
s = s.encode('latin1').decode('utf-8')
s = s.replace('lexécution', "l’exécution")
p.write_text(s, encoding='utf-8')
