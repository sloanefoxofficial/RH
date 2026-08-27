import hashlib
import re
import subprocess
import zipfile
from pathlib import Path

root = Path('/home/ubuntu/sloane_fox_source')
public = root / 'public'
html = public / 'sloanefox.html'
source_zip = Path('/home/ubuntu/upload/public.zip')
text = html.read_text()

# Existing project syntax and preload validation.
subprocess.run(['python3', str(root / 'validate_game.py')], check=True)

# Hero source assets remain exactly as originally supplied.
with zipfile.ZipFile(source_zip) as archive:
    for name in ['hero-male.png', 'fox-female.png']:
        original = hashlib.sha256(archive.read(f'public/{name}')).hexdigest()
        current = hashlib.sha256((public / name).read_bytes()).hexdigest()
        if original != current:
            raise SystemExit(f'FAIL: protected hero asset changed: {name}')
        print(f'PASS: protected hero asset unchanged: {name}')

# Existing named game roster remains intact and no entries were removed.
levels_block = re.search(r'const LEVELS=\[(.*?)\n\];', text, re.S)
minions_block = re.search(r'const MIN_TYPES=\[(.*?)\n\];', text, re.S)
if not levels_block or not minions_block:
    raise SystemExit('FAIL: expected roster declarations not found')
for key in ['anxiety', 'depress', 'toxic', 'grief', 'hardship', 'finance', 'trauma', 'death']:
    if f"key:'{key}'" not in levels_block.group(1):
        raise SystemExit(f'FAIL: existing boss missing: {key}')
for key in ['rum', 'worry', 'geist', 'burden']:
    if f"t:'{key}'" not in minions_block.group(1):
        raise SystemExit(f'FAIL: existing recurring-pressure character missing: {key}')
print('PASS: existing boss and minor-enemy roster declarations preserved')

# Finishing pass features must be present.
for token in ['RACING THOUGHTS', 'HOLD THE LINE', 'BREAKTHROUGH', 'RESILIENCE CACHE', 'bossPrelude', 'escalated', 'RESOLVE x6']:
    if token not in text:
        raise SystemExit(f'FAIL: finishing-pass feature missing: {token}')
print('PASS: 16-bit arcade finishing-pass features present')
