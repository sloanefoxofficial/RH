from PIL import Image, ImageDraw
import random
random.seed(31)
W,H=960,540
im=Image.new('RGB',(W,H),(20,25,34)); d=ImageDraw.Draw(im)
# dusk sky and deep skyline
d.rectangle((0,0,W,226), fill=(28,32,50))
for x in range(-30,W,92):
    h=random.randint(50,150)
    d.rectangle((x,210-h,x+65,210), fill=random.choice([(37,42,59),(45,43,61),(50,47,65)]))
    for yy in range(224-h,194,19):
        for xx in range(x+10,x+57,16):
            if random.random()<.55: d.rectangle((xx,yy,xx+6,yy+5), fill=random.choice([(190,141,75),(94,128,142),(63,88,105)]))
# continuous brick building mass
d.rectangle((0,115,W,302), fill=(83,48,47))
for y in range(124,300,17):
    off=0 if (y//17)%2==0 else 25
    for x in range(-off,W,50):
        d.rectangle((x+2,y,x+45,y+10), fill=random.choice([(105,58,51),(120,63,50),(75,47,49),(134,70,52)]))
        d.line((x+1,y+11,x+47,y+11), fill=(43,34,40), width=2)
# tall side walls
d.rectangle((0,88,168,302), fill=(57,49,58)); d.rectangle((792,82,960,302), fill=(57,47,53))
for side in [(0,88,168,302),(792,82,960,302)]:
    x0,y0,x1,y1=side
    for y in range(y0+12,y1,18):
        for x in range(x0+8,x1-8,47): d.rectangle((x,y,x+35,y+10), fill=(82,62,64))
# storefront bays and doors
shops=[(30,206,180,(47,60,71)),(194,220,332,(61,62,67)),(347,212,495,(48,65,69)),(510,220,653,(72,58,61)),(668,205,805,(48,63,69)),(818,198,930,(71,56,58))]
for x0,y0,x1,col in shops:
    d.rectangle((x0,y0,x1,310), fill=(30,36,44)); d.rectangle((x0+5,y0+5,x1-5,308), fill=col)
    for x in range(x0+17,x1-12,34):
        d.rectangle((x,y0+18,x+22,y0+47), fill=(19,27,36)); d.rectangle((x+3,y0+21,x+18,y0+42), fill=random.choice([(189,136,73),(113,160,163),(191,165,95)]))
    doorx=x0+(x1-x0)//2-16
    d.rectangle((doorx,y0+60,doorx+32,310), fill=(24,26,32)); d.rectangle((doorx+4,y0+66,doorx+28,306), fill=random.choice([(120,65,47),(69,55,63),(45,76,82)]))
    d.rectangle((x0+4,y0+53,x1-4,y0+60), fill=(202,112,54)); d.rectangle((x0+7,y0+49,x1-7,y0+53), fill=(221,160,74))
# hero-scale front doors (left and right emphasis)
for x in (112, 844):
    d.rectangle((x,178,x+52,318), fill=(25,24,30)); d.rectangle((x+7,187,x+45,316), fill=(136,69,48)); d.rectangle((x+11,199,x+41,204), fill=(195,112,58)); d.rectangle((x+35,252,x+40,258), fill=(242,190,79))
    d.rectangle((x-4,172,x+56,180), fill=(31,28,34)); d.rectangle((x+12,218,x+40,224), fill=(101,50,43))
# fire escapes and pipes
for x in (225, 735):
    d.line((x,110,x,292), fill=(25,29,35), width=6); d.line((x+56,110,x+56,292), fill=(25,29,35), width=6)
    for y in (145,191,237):
        d.line((x-10,y,x+66,y), fill=(31,36,42), width=5)
        for xx in range(x-4,x+62,18): d.line((xx,y,xx+7,y+38), fill=(36,40,46), width=3)
# street signs / lamps
for x in (76, 485, 877):
    d.rectangle((x,112,x+5,304), fill=(29,34,40)); d.rectangle((x-20,112,x+26,118), fill=(29,34,40)); d.rectangle((x-11,119,x+17,135), fill=(232,172,75)); d.rectangle((x-6,124,x+12,130), fill=(255,224,132))
# sidewalk and curb
d.rectangle((0,303,W,337), fill=(116,104,99)); d.rectangle((0,337,W,346), fill=(36,40,46)); d.rectangle((0,346,W,540), fill=(57,57,65))
# sidewalk slabs and road perspective texture
for x in range(-20,W,82): d.line((x,303,x+18,337), fill=(180,165,141), width=3)
for x in range(-80,W,137): d.line((x,346,x+90,540), fill=(42,44,50), width=4)
for y in range(366,540,34): d.line((0,y,W,y+8), fill=(67,66,70), width=2)
# lane highlight and manholes
d.line((0,428,W,428), fill=(89,83,77), width=3)
for x,y,r in [(176,405,17),(706,470,22),(454,510,13)]:
    d.ellipse((x-r,y-r*.45,x+r,y+r*.45), fill=(39,42,46), outline=(111,101,91), width=3)
    for k in range(-r+5,r,8): d.line((x+k,y-3,x+k+5,y+3), fill=(70,71,73), width=2)
# street objects at margins, leave center lane open
for x,y in [(48,454),(900,446),(265,475),(760,500)]:
    d.rectangle((x,y-38,x+30,y), fill=(39,49,53), outline=(19,26,31), width=3); d.rectangle((x-4,y-43,x+34,y-37), fill=(86,104,104)); d.rectangle((x+7,y-28,x+23,y-23), fill=(196,73,60))
# posters/signage, generic shapes not readable branded text
for x,y,c in [(262,151,(196,80,56)),(570,163,(72,135,147)),(690,142,(214,159,67))]:
    d.rectangle((x,y,x+48,y+28), fill=(27,31,38)); d.rectangle((x+4,y+4,x+44,y+24), fill=c)
    d.rectangle((x+12,y+10,x+36,y+14), fill=(238,205,132)); d.rectangle((x+18,y+17,x+30,y+21), fill=(39,45,54))
# foreground angled debris strips
for i in range(28):
    x=random.randrange(0,W); y=random.randrange(370,535); ln=random.randrange(5,22)
    d.rectangle((x,y,x+ln,y+random.choice([2,3])), fill=random.choice([(82,78,76),(102,91,77),(37,40,46),(131,108,77)]))
# rain highlights
a=Image.new('RGBA',(W,H),(0,0,0,0)); ra=ImageDraw.Draw(a)
for i in range(110):
    x=random.randrange(W); y=random.randrange(0,350); ra.line((x,y,x-4,y+11), fill=(176,204,213,75), width=1)
im=Image.alpha_composite(im.convert('RGBA'),a).convert('RGB')
im.save('/home/ubuntu/sloane_fox_source/public/scene01_rainy_side_street.png', optimize=True)
print('wrote', im.size)
