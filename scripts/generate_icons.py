"""Generate PNG PWA icons without third-party dependencies."""
from pathlib import Path
import struct
import zlib

def png(size):
    rows=[]
    for y in range(size):
        row=bytearray([0])
        for x in range(size):
            X=x/size;Y=y/size
            blue=(.16<X<.48 and .29<Y<.73 and abs(Y-.51)<.24) or (.52<X<.84 and .29<Y<.73)
            spine=abs(X-.5)<.015 and .31<Y<.78
            if blue and (.19<X<.81) and (.32<Y<.71):
                color=(23,58,94)
            else: color=(11,20,34)
            edge=(abs(X-.18)<.015 and .3<Y<.72) or (abs(X-.82)<.015 and .3<Y<.72) or (abs(Y-.73)<.015 and .19<X<.81)
            if edge or spine: color=(56,137,249)
            row.extend((*color,255))
        rows.append(bytes(row))
    def chunk(tag,data):return struct.pack('!I',len(data))+tag+data+struct.pack('!I',zlib.crc32(tag+data)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows),9))+chunk(b'IEND',b'')

for size in (192,512):
    Path('public').mkdir(exist_ok=True)
    Path(f'public/icon-{size}.png').write_bytes(png(size))
