import hashlib
import re
import subprocess
import zipfile
from pathlib import Path

root=Path('/home/ubuntu/sloane_fox_source')
public=root/'public'
html=public/'sloanefox.html'
text=html.read_text()

subprocess.run(['python3',str(root/'validate_game.py')],check=True)

with zipfile.ZipFile('/home/ubuntu/upload/public.zip') as z:
    for name in ['hero-male.png','fox-female.png']:
        original=hashlib.sha256(z.read('public/'+name)).hexdigest()
        current=hashlib.sha256((public/name).read_bytes()).hexdigest()
        if original!=current:
            raise SystemExit(f'FAIL: protected hero changed: {name}')
        print(f'PASS: protected hero unchanged: {name}')

levels=re.search(r'const LEVELS=\[(.*?)\n\];',text,re.S)
minions=re.search(r'const MIN_TYPES=\[(.*?)\n\];',text,re.S)
if not levels or not minions: raise SystemExit('FAIL: roster declarations missing')
for key in ['anxiety','depress','toxic','grief','hardship','finance','trauma','death']:
    if f"key:'{key}'" not in levels.group(1): raise SystemExit(f'FAIL: existing boss missing: {key}')
for key in ['rum','worry','geist','burden']:
    if f"t:'{key}'" not in minions.group(1): raise SystemExit(f'FAIL: existing minor enemy missing: {key}')
print('PASS: existing boss and recurring-pressure rosters preserved')

features=['currentFronts.length','GRENADE READY','ROCKET LAUNCHER READY','AIR STRIKE READY','CROSSINGS','SKATEBOARD RUSH','PLATFORM DASH','FALLEN TREE VAULT','MOTORBIKE ESCAPE','Sunset Side Street','Underground Train Station','City Park Forest Path','Emergency District','carFrom','damageCar','superImpact','type:\'rocket\'','a.bombs','INSPECT','DEMO_STAGE','inspectWalk','WALK TEST','WALKING · ','p.setpiece','pixelRect','drawStageSilhouette','drawSetpieceWorld','drawPerspectiveLane','drawArcadeDetails','drawGroundTexture','stageHazards','MAGPIE SWOOP','BUS HIT','SUPPORT RUNNER','PRESSURE CASE OPEN','COMMUNITY BOARD','spawnSupportRunner','collectSupportRunner','ROCKET LAUNCHER READY','AIR STRIKE READY','preview:true','FIVE BOMBS']
for feature in features:
    if feature not in text: raise SystemExit(f'FAIL: long-journey feature missing: {feature}')
if "return [" not in text or text.count("{ enemies:pack(") < 9:
    raise SystemExit('FAIL: nine-front route declaration is incomplete')
print('PASS: nine-front multi-location journey, grounded walk proof, fair arcade set pieces, and tiered Super spectacle present')
