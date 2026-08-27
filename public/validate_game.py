import re
import subprocess
from pathlib import Path

root = Path('/home/ubuntu/sloane_fox_source')
html = root / 'public' / 'sloanefox.html'
text = html.read_text()

match = re.search(r'<script>\s*(\(function\(\)\{.*?\n\}\)\(\);)\s*</script>', text, re.S)
if not match:
    raise SystemExit('FAIL: main JavaScript block not found')
js_path = root / '_syntax_check_sloanefox.js'
js_path.write_text(match.group(1))
result = subprocess.run(['node', '--check', str(js_path)], capture_output=True, text=True)
if result.returncode:
    print(result.stderr)
    raise SystemExit('FAIL: JavaScript syntax check failed')
print('PASS: JavaScript syntax')

load_match = re.search(r'const toLoad=\{(.*?)\};', text, re.S)
if not load_match:
    raise SystemExit('FAIL: preload map not found')
files = re.findall(r"'([^']+\.(?:png|jpg|jpeg|webp))'", load_match.group(1), re.I)
missing = [name for name in files if not (root / 'public' / name).is_file()]
if missing:
    raise SystemExit('FAIL: missing preloaded assets: ' + ', '.join(missing))
print(f'PASS: {len(files)} preloaded image assets found')

for token in ['frontBlueprint', 'drawProp', 'CLEAN_ENEMY_ART', 'DEMO_MODE', 'throwGrenade', 'fireBazooka', 'callAirStrike']:
    if token not in text:
        raise SystemExit(f'FAIL: expected upgrade token missing: {token}')
for forbidden in ["KeyR:'p1roll'", "KeyL:'p2roll'", "KeyH:'p1melee'", "Quote:'p2melee'", 'p.rolling', 'p.chaining']:
    if forbidden in text:
        raise SystemExit(f'FAIL: removed hero mechanic is still present: {forbidden}')
print('PASS: brawler, city Super, demo, and simplified hero controls present')
