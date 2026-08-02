#!/usr/bin/env python3
"""Static, standard-library Genesis ROM inspector for EHRDB private research.

Writes metadata and an optional diagnostic raw-4bpp tail atlas. Never commit the
ROM or generated extracted-art images; use an ignored private output directory.
"""
from __future__ import annotations
import argparse, hashlib, json, math, re, struct, zlib
from collections import Counter
from pathlib import Path
from typing import Any

VECTORS=["initial_ssp","reset_pc","bus_error","address_error","illegal_instruction","divide_by_zero","chk","trapv","privilege_violation","trace","line_1010","line_1111","reserved_12","coprocessor_protocol","format_error","uninitialized_interrupt"]+[f"reserved_{i}" for i in range(16,24)]+["spurious_interrupt","level_1_interrupt","level_2_interrupt","level_3_interrupt","level_4_interrupt","level_5_interrupt","level_6_interrupt","level_7_interrupt"]+[f"trap_{i}" for i in range(16)]+[f"reserved_{i}" for i in range(48,64)]
TEXT={"console_name":(0x100,0x110),"copyright":(0x110,0x120),"domestic_title":(0x120,0x150),"international_title":(0x150,0x180),"serial_version":(0x180,0x18E),"io_support":(0x190,0x1A0),"modem_support":(0x1BC,0x1C8),"memo":(0x1C8,0x1F0),"region":(0x1F0,0x200)}
KEYWORDS=("ROUND","STATISTICS","CAREER","EXHIBITION","GREATEST","RANK","TRAIN","HOLYFIELD","BEAST","BOXER","WON","LOST","SCORE")

def u16(d:bytes,o:int)->int:return int.from_bytes(d[o:o+2],"big")
def u32(d:bytes,o:int)->int:return int.from_bytes(d[o:o+4],"big")
def txt(d:bytes,a:int,b:int)->str:return d[a:b].decode("ascii",errors="replace").rstrip(" \0")
def checksum(d:bytes)->int:
 p=d[0x200:]+(b"\0" if (len(d)-0x200)&1 else b"")
 return sum(struct.unpack(f">{len(p)//2}H",p))&0xffff
def entropy(d:bytes)->float:
 if not d:return 0.0
 return -sum((n/len(d))*math.log2(n/len(d)) for n in Counter(d).values())
def address_class(v:int,size:int)->tuple[str,int]:
 a=v&0xffffff
 if a<size:return "ROM",a
 if 0xa00000<=a<=0xa0ffff:return "Z80_RAM",a
 if 0xa10000<=a<=0xa1ffff:return "IO",a
 if 0xc00000<=a<=0xc0001f:return "VDP",a
 if 0xff0000<=a<=0xffffff:return "WORK_RAM",a
 return "OTHER",a
def runs(d:bytes,minimum:int=32)->list[dict[str,int]]:
 out=[];s=0
 while s<len(d):
  b=d[s];e=s+1
  while e<len(d) and d[e]==b:e+=1
  if e-s>=minimum:out.append({"start":s,"end_exclusive":e,"length":e-s,"byte":b})
  s=e
 return out
def chunk(kind:bytes,payload:bytes)->bytes:
 return struct.pack(">I",len(payload))+kind+payload+struct.pack(">I",zlib.crc32(kind+payload)&0xffffffff)
def gray_png(path:Path,w:int,h:int,pixels:bytes)->None:
 rows=b"".join(b"\0"+pixels[y*w:(y+1)*w] for y in range(h))
 path.write_bytes(b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",w,h,8,0,0,0,0))+chunk(b"IDAT",zlib.compress(rows,9))+chunk(b"IEND",b""))
def tile_png(data:bytes,path:Path,cols:int)->dict[str,int]:
 count=len(data)//32;rows=math.ceil(count/cols);w=cols*8;h=rows*8;px=bytearray(w*h)
 for t in range(count):
  tile=data[t*32:(t+1)*32];ty,tx=divmod(t,cols)
  for y in range(8):
   for pair,b in enumerate(tile[y*4:y*4+4]):
    x=tx*8+pair*2;row=(ty*8+y)*w
    px[row+x]=((b>>4)&15)*17;px[row+x+1]=(b&15)*17
 gray_png(path,w,h,bytes(px));return {"tile_count":count,"columns":cols,"rows":rows,"width":w,"height":h}
def inspect(data:bytes,name:str,block:int)->dict[str,Any]:
 if len(data)<0x200:raise ValueError("too short for a Genesis header")
 h={k:txt(data,*r) for k,r in TEXT.items()};calc=checksum(data)
 h.update({"header_checksum":u16(data,0x18e),"computed_checksum":calc,"checksum_match":u16(data,0x18e)==calc,"rom_start":u32(data,0x1a0),"rom_end":u32(data,0x1a4),"ram_start":u32(data,0x1a8),"ram_end":u32(data,0x1ac),"backup_memory":{"signature":txt(data,0x1b0,0x1b2),"flags_raw":data[0x1b2:0x1b4].hex().upper(),"start":u32(data,0x1b4),"end":u32(data,0x1b8)}})
 h["declared_rom_size"]=h["rom_end"]-h["rom_start"]+1;h["declared_size_matches_file"]=h["declared_rom_size"]==len(data)
 vec=[]
 for i,n in enumerate(VECTORS):
  v=u32(data,i*4);c,a=address_class(v,len(data));vec.append({"index":i,"name":n,"table_offset":i*4,"value":v,"value_hex":f"0x{v:08X}","masked_24bit":a,"masked_24bit_hex":f"0x{a:06X}","class":c})
 blocks=[]
 for s in range(0,len(data),block):
  b=data[s:s+block];c=Counter(b);blocks.append({"start":s,"end_exclusive":s+len(b),"entropy":round(entropy(b),6),"unique_bytes":len(c),"zero_fraction":round(c.get(0,0)/len(b),6),"ff_fraction":round(c.get(255,0)/len(b),6)})
 strings=[(m.start(),m.group().decode("ascii",errors="replace")) for m in re.finditer(rb"[\x20-\x7e]{4,}",data)]
 anchors=[{"offset":o,"offset_hex":f"0x{o:06X}","length":len(s),"preview":s.replace("@"," ")[:96]} for o,s in strings if any(k in s.upper() for k in KEYWORDS)]
 fill=runs(data);ff=[r for r in fill if r["byte"]==255 and r["length"]>=0x1000];tail=None
 if ff:
  r=max(ff,key=lambda x:x["length"]);start=(r["end_exclusive"]+31)&~31
  if start<len(data):tail={"preceding_fill_start":r["start"],"preceding_fill_end_exclusive":r["end_exclusive"],"preceding_fill_length":r["length"],"start":start,"end_exclusive":len(data),"length":len(data)-start,"aligned_32_bytes":start%32==0 and (len(data)-start)%32==0,"raw_4bpp_tile_count":(len(data)-start)//32,"entropy":round(entropy(data[start:]),6)}
 return {"schema":"ehrdb-rom-atlas-v1","source_file":name,"hashes":{"size_bytes":len(data),"md5":hashlib.md5(data).hexdigest(),"sha1":hashlib.sha1(data).hexdigest(),"sha256":hashlib.sha256(data).hexdigest()},"header":h,"vectors":vec,"entropy_block_size":block,"entropy_blocks":blocks,"printable_ascii_run_count":len(strings),"string_anchors":anchors,"long_fill_runs":sorted(fill,key=lambda x:x["length"],reverse=True)[:64],"tail_graphics_candidate":tail}
def main()->int:
 p=argparse.ArgumentParser();p.add_argument("rom",type=Path);p.add_argument("--out",type=Path,required=True);p.add_argument("--block-size",type=lambda x:int(x,0),default=0x1000);p.add_argument("--render-tail",action="store_true");p.add_argument("--tile-columns",type=int,default=16);a=p.parse_args()
 data=a.rom.read_bytes();a.out.mkdir(parents=True,exist_ok=True);m=inspect(data,a.rom.name,a.block_size);(a.out/"ROM_METADATA.json").write_text(json.dumps(m,indent=2)+"\n")
 if a.render_tail and m["tail_graphics_candidate"]:
  t=m["tail_graphics_candidate"];info=tile_png(data[t["start"]:t["end_exclusive"]],a.out/"private_tail_4bpp.png",a.tile_columns);(a.out/"TAIL_TILE_INFO.json").write_text(json.dumps(info,indent=2)+"\n")
 print(json.dumps({"output":str(a.out),"checksum_match":m["header"]["checksum_match"],"sha256":m["hashes"]["sha256"],"tail_graphics_candidate":m["tail_graphics_candidate"]},indent=2));return 0
if __name__=="__main__":raise SystemExit(main())
