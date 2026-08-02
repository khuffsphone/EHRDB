#!/usr/bin/env python3
"""Synthetic standard-library tests for inspect_rom.py; no historical bytes."""
from __future__ import annotations
import importlib.util,tempfile,unittest
from pathlib import Path
P=Path(__file__).with_name('inspect_rom.py');S=importlib.util.spec_from_file_location('ehrdb_rom',P);assert S and S.loader
R=importlib.util.module_from_spec(S);S.loader.exec_module(R)
def fixture()->bytes:
 d=bytearray(0x400);d[0:4]=(0xffffff00).to_bytes(4,'big');d[4:8]=(0x200).to_bytes(4,'big')
 d[0x100:0x110]=b'SEGA GENESIS    ';d[0x110:0x120]=b'(C)TEST 2026.AUG';d[0x120:0x150]=b'SYNTHETIC TEST'.ljust(0x30,b' ');d[0x150:0x180]=b'SYNTHETIC TEST'.ljust(0x30,b' ');d[0x180:0x18e]=b'GM TEST000 -00';d[0x190:0x1a0]=b'J'.ljust(16,b' ')
 d[0x1a0:0x1a4]=(0).to_bytes(4,'big');d[0x1a4:0x1a8]=(len(d)-1).to_bytes(4,'big');d[0x1a8:0x1ac]=(0xff0000).to_bytes(4,'big');d[0x1ac:0x1b0]=(0xffffff).to_bytes(4,'big');d[0x1b0:0x1b2]=b'RA';d[0x1b2:0x1b4]=bytes.fromhex('E840');d[0x1b4:0x1b8]=(0x200001).to_bytes(4,'big');d[0x1b8:0x1bc]=(0x200001).to_bytes(4,'big');d[0x1f0:0x200]=b'U'.ljust(16,b' ');d[0x200:0x204]=bytes.fromhex('4E714E75');d[0x18e:0x190]=R.checksum(bytes(d)).to_bytes(2,'big');return bytes(d)
class TestInspector(unittest.TestCase):
 def test_header(self):
  m=R.inspect(fixture(),'synthetic.bin',0x100);h=m['header'];self.assertTrue(h['checksum_match']);self.assertTrue(h['declared_size_matches_file']);self.assertEqual(h['backup_memory']['flags_raw'],'E840')
 def test_vectors_use_24_bit_bus(self):
  m=R.inspect(fixture(),'synthetic.bin',0x100);self.assertEqual(m['vectors'][0]['class'],'WORK_RAM');self.assertEqual(m['vectors'][1]['class'],'ROM')
 def test_png(self):
  with tempfile.TemporaryDirectory() as x:
   p=Path(x)/'x.png';R.gray_png(p,2,2,bytes([0,85,170,255]));self.assertEqual(p.read_bytes()[:8],b'\x89PNG\r\n\x1a\n')
if __name__=='__main__':unittest.main()
