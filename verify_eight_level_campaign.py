from pathlib import Path
import hashlib
import re
from PIL import Image

root=Path('/home/ubuntu/sloane_fox_source')
html=(root/'public/sloanefox.html').read_text()
checks=[]

def need(label, condition):
    checks.append((label, bool(condition)))

level_rows=re.findall(r"\{ key:'([^']+)',\s+img:'(b\d)',\s+name:'([^']+)'[\s\S]*?stage:'([^']+)'",html)
need('exactly eight declared boss levels',len(level_rows)==8)
need('eight distinct boss image slots',{row[1] for row in level_rows}=={f'b{i}' for i in range(1,9)})
need('eight distinct level stages',{row[3] for row in level_rows}=={'street','station','park','square','yard','market','emergency','bridge'})
need('nine combat fronts are generated',"['surge','hold','breakthrough','hold','surge','breakthrough','hold','surge','hold']" in html)
need('eight unique compact arcade moments',all(token in html for token in ['SKATEBOARD RUSH','PLATFORM DASH','FALLEN TREE VAULT','PUDDLE RUN','FORKLIFT CROSSING','BARRIER DASH','MOTORBIKE ESCAPE','LAST SIGNAL']))
need('eight distinct environmental hazards',all(token in html for token in ["street:'bus'","station:'train'","park:'bird'","square:'puddle'","yard:'forklift'","market:'barrier'","emergency:'ambulance'","bridge:'wind'"]))
need('eight boss-arena stage treatments',all(token in html for token in ["st==='street'","st==='station'","st==='park'","st==='square'","st==='yard'","st==='market'","st==='emergency'","st==='bridge'"]))
need('clear tiered Super labels',all(token in html for token in ['GRENADE READY','ROCKET LAUNCHER READY','AIR STRIKE READY']))
need('hero roll remains absent',"'roll'" not in html.lower())
need('hero chain remains absent',"hero chain" not in html.lower())
need('display-only hero compositor is active',all(token in html for token in ['const HERO_DISPLAY=', 'function drawArcadeHeroFrame', 'function heroGroundShadow']))
need('hero fallback uses display-only compositor',"arcade:true" in html)

scene_names=['scene01_rainy_side_street.png','scene02_underground_station.png','scene03_cc0_park_path.png','scene04_memorial_square.png','scene05_industrial_yard.png','scene06_night_market.png','scene07_emergency_district.png','scene08_rail_bridge.png']
scene_hashes=[]
for n in scene_names:
    p=root/'public'/n
    valid=p.exists()
    if valid:
        im=Image.open(p)
        valid=im.size[0]/im.size[1]==16/9
        scene_hashes.append(hashlib.sha256(p.read_bytes()).hexdigest())
    need(f'scene asset valid: {n}',valid)
need('eight scene plates are non-duplicated',len(set(scene_hashes))==8)

original_zip=root.parent/'upload/public.zip'
need('authoritative source archive exists',original_zip.exists())
# Existing validators remain the source of truth for protected-source matching.
for label,ok in checks:
    print(('PASS' if ok else 'FAIL')+': '+label)
if not all(ok for _,ok in checks): raise SystemExit(1)
print('PASS: full eight-level campaign structure verified')
