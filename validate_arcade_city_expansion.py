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

features=['currentFronts.length','GRENADE READY','ROCKET READY','AIR STRIKE READY','CROSSINGS','CITY ROPE SWING','carFrom','damageCar','drawCarProp','drawTrafficCar','superImpact','type:\'rocket\'','a.bombs','INSPECT','inspectWalk','WALK TEST','WALKING · ','modes=[\'surge\',\'hold\',\'breakthrough\',\'hold\',\'surge\',\'breakthrough\',\'hold\']','p.traversing','CITY TREE','preview:true','FIVE BOMBS']
for feature in features:
    if feature not in text: raise SystemExit(f'FAIL: visible-repair feature missing: {feature}')
if "return [" not in text or text.count("{ enemies:pack(") < 7:
    raise SystemExit('FAIL: seven-front route declaration is incomplete')
print('PASS: extended seven-front route, grounded walk proof, set-piece traversal, city cars, and tiered Super spectacle present')
