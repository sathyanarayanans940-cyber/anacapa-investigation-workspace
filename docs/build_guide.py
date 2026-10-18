from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SHOTS=ROOT/'docs/images/retina/processed'
OUT=ROOT/'output/pdf/Anacapa-Guide.pdf'
OUT.parent.mkdir(parents=True,exist_ok=True)
FONTS=Path('/System/Library/Fonts/Supplemental')
for name,file in [('Body','Georgia.ttf'),('Bold','Georgia Bold.ttf'),('BodyItalic','Georgia Italic.ttf'),('BoldItalic','Georgia Bold Italic.ttf'),('Book','Georgia.ttf'),('BookBold','Georgia Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(FONTS/file)))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='Bold',italic='BodyItalic',boldItalic='BoldItalic')
W,H=A4;M=46;CW=W-2*M
INK=HexColor('#403a32');MUTED=HexColor('#796c5d');ACCENT=HexColor('#9b7b56');LINE=HexColor('#ddd1c0');PAPER=HexColor('#fbf8f3');WARM=HexColor('#eee5d7');GREEN=HexColor('#74836d')
styles={
 'body':ParagraphStyle('body',fontName='Body',fontSize=10.5,leading=15.5,textColor=INK),
 'lede':ParagraphStyle('lede',fontName='Body',fontSize=11.7,leading=17.5,textColor=MUTED),
 'caption':ParagraphStyle('caption',fontName='BodyItalic',fontSize=9,leading=12.7,textColor=MUTED),
 'small':ParagraphStyle('small',fontName='Body',fontSize=9.7,leading=14,textColor=INK),
 'table':ParagraphStyle('table',fontName='Body',fontSize=9.6,leading=14,textColor=INK),
}
# Each page teaches a complete task. The pictures are actual app screenshots
# from a fictional, separate workspace, never the user's saved investigation.
from guide_content import pages, contents_groups
PAGE_COUNT = len(pages) + 1
PAGE_NUMBERS = {page['id']: number for number, page in enumerate(pages, 2)}
FIGURES = []
c=canvas.Canvas(str(OUT),pagesize=A4,pageCompression=1)
c.setTitle('Anacapa User Guide - 0.4.1');c.setCreator('Anacapa guide builder');c.setAuthor('Anacapa');c.setSubject('An illustrated guide to local investigation boards, nested timelines, and cross-branch relationships')
y=0

def para(text,style='body',width=CW,x=M,gap=9,draw=True):
 global y
 p=Paragraph(text,styles[style]);_,height=p.wrap(width,H)
 if draw:p.drawOn(c,x,y-height);y-=height+gap
 return height+gap

def header(number,title):
 global y
 c.setFillColor(PAPER);c.rect(0,0,W,H,fill=1,stroke=0)
 c.setFillColor(ACCENT);c.setFont('Body',9);c.drawString(M,H-33,'anacapa   /   USER GUIDE')
 c.setFillColor(MUTED);c.drawRightString(W-M,H-33,'LOCAL EDITION   0.4.1')
 c.bookmarkPage('p'+str(number));c.addOutlineEntry(title,'p'+str(number),0,False)
 c.setFillColor(INK);c.setFont('Book',25);c.drawString(M,H-83,title)
 y=H-105

def footer(n):
 c.setFillColor(MUTED);c.setFont('Body',8);c.drawString(M,25,'Anacapa  /  Local investigation workspace')
 c.drawRightString(W-M,25,f'{n:02}  /  {PAGE_COUNT}')
 if n>2:c.linkRect('', 'p2',(M,17,M+150,34),relative=0,thickness=0)

def figure(name,caption='',maxh=230,crop=None):
 global y
 path=SHOTS/(name+'.png');iw,ih=Image.open(path).size
 x0,top,sw,sh=crop or (0,0,iw,ih)
 # Bound a requested crop to the captured screenshot.
 sw=min(sw,iw-x0);sh=min(sh,ih-top)
 scale=min(CW/sw,maxh/sh);dw,dh=sw*scale,sh*scale;x=M+(CW-dw)/2
 c.saveState();clip=c.beginPath();clip.roundRect(x,y-dh,dw,dh,9);c.clipPath(clip,stroke=0,fill=0)
 c.drawImage(ImageReader(str(path)),x-x0*scale,y-dh-(ih-top-sh)*scale,iw*scale,ih*scale,mask='auto');c.restoreState()
 c.setStrokeColor(LINE);c.setLineWidth(.6);c.roundRect(x,y-dh,dw,dh,9,stroke=1,fill=0)
 FIGURES.append({'name':name,'pixels':[int(sw),int(sh)],'points':[round(dw,1),round(dh,1)],'ppi':round(72/scale)})
 y-=dh+8
 if caption:para(caption,'caption',gap=11)
 else:y-=8

def table(rows,draw=True):
 global y
 widths=[CW*.26,CW*.74];total=0
 for i,row in enumerate(rows):
  ps=[Paragraph(('<b>'+escape(txt)+'</b>') if i==0 else escape(txt),styles['table']) for txt in row]
  hs=[p.wrap(widths[j]-18,H)[1] for j,p in enumerate(ps)];rh=max(hs)+16;total+=rh
  if draw:
   c.setFillColor(WARM if i==0 else PAPER);c.rect(M,y-rh,CW,rh,fill=1,stroke=0)
   c.setStrokeColor(LINE);c.setLineWidth(.4);c.line(M,y-rh,W-M,y-rh)
   for j,p in enumerate(ps):p.drawOn(c,M+sum(widths[:j])+9,y-8-hs[j])
   y-=rh
 if draw:y-=10
 return total+10

def note(title,text,draw=True):
 global y
 pp=Paragraph('<b>'+title+'</b><br/>'+text,styles['small']);_,hh=pp.wrap(CW-28,H);height=hh+25
 if draw:
  c.setFillColor(WARM);c.roundRect(M,y-height,CW,height,8,fill=1,stroke=0)
  pp.drawOn(c,M+14,y-12-hh);y-=height+9
 return height+9

def block_height(block):
 typ,v=block
 if typ=='h':return 28
 if typ=='p':return para(v,draw=False)
 if typ=='steps':return sum(para(f'<b>{i+1}.</b> {s}',draw=False,gap=8) for i,s in enumerate(v))
 if typ=='table':return table(v,draw=False)
 if typ=='note':return note(*v,draw=False)
 return 0

def blocks(items):
 global y
 for typ,v in items:
  if typ=='h':
   y-=7;c.setFillColor(INK);c.setFont('Bold',12.5);c.drawString(M,y-13,v);y-=28
  elif typ=='p':para(v)
  elif typ=='steps':
   for i,s in enumerate(v):para(f'<b>{i+1}.</b> {s}',gap=8)
  elif typ=='table':table(v)
  elif typ=='note':note(*v)

def box(x,top,width,height,title,detail=''):
 c.setFillColor(HexColor('#fffdf8'));c.setStrokeColor(LINE);c.roundRect(x,top-height,width,height,9,fill=1,stroke=1)
 p=Paragraph('<b>'+title+'</b>',styles['small']);_,ph=p.wrap(width-22,H);p.drawOn(c,x+11,top-12-ph)
 if detail:
  p=Paragraph(detail,styles['caption']);_,ph=p.wrap(width-22,H);p.drawOn(c,x+11,top-height+12)

def line(x1,y1,x2,y2,dashed=False):
 c.setStrokeColor(ACCENT);c.setLineWidth(1.2);c.setDash(4,4) if dashed else c.setDash()
 c.line(x1,y1,x2,y2);c.setDash()
 c.setFillColor(ACCENT);c.circle(x2,y2,2.6,fill=1,stroke=0)

def diagram(kind):
 global y
 t=y
 if kind=='storage':
  box(M,t,CW,60,'Anacapa app folder','Launcher and built app<br/>.anacapa-data: registry and older workspace cases')
  line(M+CW/2,t-60,M+CW/2,t-92)
  box(M,t-94,CW*.47,72,'Your browser','Board and timeline<br/>Appearance preferences')
  box(M+CW*.53,t-94,CW*.47,72,'Chosen case folders','case.json / originals<br/>snapshots / audit / head')
  y-=185
 elif kind=='hierarchy':
  a=M+10;b=M+255
  box(M,t,CW,42,'The Harbor Files')
  line(M+125,t-42,M+125,t-64);line(M+375,t-42,M+375,t-64)
  box(a,t-66,230,50,'The midnight delivery','Parent event and its branch')
  box(b,t-66,230,50,'Records review','Another parent event and branch')
  line(a+110,t-116,a+110,t-138);line(b+110,t-116,b+110,t-138)
  box(a,t-140,230,46,'Vehicle enters the gate','Child card with its own possible timeline')
  box(b,t-140,230,46,'Seal comparison','Child in a different sub-timeline')
  c.setFont('Body',9);c.setFillColor(MUTED);c.drawString(M+8,t-209,'Repeat the same parent > child pattern for deeper levels.')
  y-=230

# Cover
c.setFillColor(PAPER);c.rect(0,0,W,H,fill=1,stroke=0)
c.bookmarkPage('p1');c.addOutlineEntry('Anacapa User Guide','p1',0,False)
icon=ROOT/'public/icons/original-light-512.png'
c.drawImage(str(icon),M,H-105,47,47,mask='auto')
c.setFillColor(ACCENT);c.setFont('Body',10);c.drawString(M,H-137,'LOCAL EDITION   /   VERSION 0.4.1   /   OCTOBER 2026')
c.setFillColor(INK);c.setFont('Book',45);c.drawString(M,H-197,'Anacapa')
c.setFont('Book',31);c.drawString(M,H-238,'User Guide')
y=H-267
para('Build investigation boards, follow nested timelines, and connect evidence across branches.','lede',gap=18)
figure('cover',maxh=250)
para('Current controls: click a card to edit; its double-arrow opens sub-events. Updated instructions cover zoom locking and expanded view. Screenshots of the fictional Harbor Tutorial retain version 0.3.3 visuals.','body',gap=14)
note('What you will learn','Create local case folders, choose security controls, record sources, follow nested timelines, connect evidence across branches, and share or recover an investigation.')
footer(1);c.showPage()
# Task-based chapters, with an automatically numbered clickable contents page
for number,page in enumerate(pages,2):
 header(number,page['title']);para(page['lede'],'lede',gap=15)
 if page.get('special')=='contents':
  for label,ids in contents_groups:
   y-=3;c.setFont('Bold',11.5);c.setFillColor(INK);c.drawString(M,y-12,label);y-=23
   for ident in ids:
    pnum=PAGE_NUMBERS[ident];title=next(p['title'] for p in pages if p['id']==ident)
    c.setFont('Body',10.2);c.setFillColor(INK);c.drawString(M+9,y-10,title);c.setFillColor(ACCENT);c.drawRightString(W-M,y-10,f'{pnum:02}');c.linkRect('',f'p{pnum}',(M,y-16,W-M,y+3),relative=0,thickness=0);y-=17
  y-=6;para('Read the Getting started chapters first. For the cross-timeline exercise, open a fresh Harbor Tutorial copy and follow the Connecting chapters. Chapter names are clickable; page footers return here.','caption')
 else:
  content=page['blocks'];estimated=sum(block_height(b) for b in content)
  if page.get('diagram'):diagram(page['diagram'])
  if page.get('figure'):
   cap=page.get('caption','');caph=para(cap,'caption',draw=False,gap=11) if cap else 8
   available=y-54-estimated-caph-16
   if available < 65: raise ValueError(f'Page {number}: too little room for the screenshot ({available:.1f} pt)')
   figure(page['figure'],cap,maxh=min(page.get('maxfig',230),available),crop=page.get('crop'))
  blocks(content)
 if y<44:raise ValueError(f'Page {number} overflow: {y}')
 print(f'Page {number:02} clean layout, content ends at {y:.1f} pt')
 footer(number);c.showPage()
c.save()
import json
(OUT.parent/'guide-image-quality.json').write_text(json.dumps({'pageCount':PAGE_COUNT,'figures':FIGURES},indent=2))
print(OUT)
