import {createHash} from 'node:crypto';
import {deflateRawSync,inflateRawSync} from 'node:zlib';

const fail=m=>{throw new Error('ZIP_PORTABLE_INVALID: '+m);};
const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
export const crc32=buf=>{let c=0xFFFFFFFF;for(const b of buf)c=CRC_TABLE[(c^b)&0xFF]^(c>>>8);return(c^0xFFFFFFFF)>>>0;};
const sha256=buf=>createHash('sha256').update(buf).digest('hex');
const collisionKey=p=>p.normalize('NFC').toLocaleLowerCase('en-US');

export function validatePortablePath(rel){
 if(typeof rel!=='string'||!rel||rel.startsWith('/')||rel.includes('\\')||rel.split('/').includes('..')||rel.includes('\0'))fail('unsafe ZIP path '+rel);
 if(rel.toLowerCase().endsWith('.zip'))fail('nested ZIP forbidden: '+rel);
}

export function assertPortablePathCollisions(paths){
 const seen=new Map();
 for(const raw of paths){
  const p=raw.normalize('NFC');validatePortablePath(p);const key=collisionKey(p);
  if(seen.has(key)&&seen.get(key)!==p)fail(`Windows/NFC case collision: ${seen.get(key)} vs ${p}`);
  seen.set(key,p);
 }
}

export function buildPortableZip(entries){
 assertPortablePathCollisions(entries.map(x=>x.rel));
 const local=[],central=[];let offset=0;const flags=0x0800,method=8,dosTime=0,dosDate=0x21;
 for(const e of entries){
  const name=Buffer.from(e.rel.normalize('NFC'),'utf8'),raw=Buffer.from(e.data),comp=deflateRawSync(raw,{level:9}),crc=crc32(raw);
  const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(flags,6);lh.writeUInt16LE(method,8);lh.writeUInt16LE(dosTime,10);lh.writeUInt16LE(dosDate,12);lh.writeUInt32LE(crc,14);lh.writeUInt32LE(comp.length,18);lh.writeUInt32LE(raw.length,22);lh.writeUInt16LE(name.length,26);lh.writeUInt16LE(0,28);
  local.push(lh,name,comp);
  const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);ch.writeUInt16LE(flags,8);ch.writeUInt16LE(method,10);ch.writeUInt16LE(dosTime,12);ch.writeUInt16LE(dosDate,14);ch.writeUInt32LE(crc,16);ch.writeUInt32LE(comp.length,20);ch.writeUInt32LE(raw.length,24);ch.writeUInt16LE(name.length,28);ch.writeUInt16LE(0,30);ch.writeUInt16LE(0,32);ch.writeUInt16LE(0,34);ch.writeUInt16LE(0,36);ch.writeUInt32LE(0,38);ch.writeUInt32LE(offset,42);
  central.push(ch,name);offset+=lh.length+name.length+comp.length;
 }
 const cb=Buffer.concat(central),lb=Buffer.concat(local),e=Buffer.alloc(22);
 e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(0,4);e.writeUInt16LE(0,6);e.writeUInt16LE(entries.length,8);e.writeUInt16LE(entries.length,10);e.writeUInt32LE(cb.length,12);e.writeUInt32LE(lb.length,16);e.writeUInt16LE(0,20);
 return Buffer.concat([lb,cb,e]);
}

const findEocd=buf=>{for(let i=buf.length-22;i>=Math.max(0,buf.length-65557);i--)if(buf.readUInt32LE(i)===0x06054b50)return i;fail('EOCD missing/truncated ZIP');};

export function parsePortableZip(buf){
 const e=findEocd(buf),count=buf.readUInt16LE(e+10),centralSize=buf.readUInt32LE(e+12),centralOffset=buf.readUInt32LE(e+16),commentLen=buf.readUInt16LE(e+20);
 if(e+22+commentLen!==buf.length)fail('unexpected trailing ZIP bytes/comment');
 if(centralOffset+centralSize!==e)fail('central directory bounds mismatch');
 let p=centralOffset;const out=[];
 for(let i=0;i<count;i++){
  if(buf.readUInt32LE(p)!==0x02014b50)fail('central header signature mismatch');
  const flags=buf.readUInt16LE(p+8),method=buf.readUInt16LE(p+10),crc=buf.readUInt32LE(p+16),cs=buf.readUInt32LE(p+20),us=buf.readUInt32LE(p+24),nl=buf.readUInt16LE(p+28),el=buf.readUInt16LE(p+30),cl=buf.readUInt16LE(p+32),lo=buf.readUInt32LE(p+42);
  if(flags&0x0008)fail('data-descriptor ZIP entries forbidden');if(method!==0&&method!==8)fail('unsupported compression method '+method);
  const rel=buf.subarray(p+46,p+46+nl).toString('utf8').normalize('NFC');validatePortablePath(rel);
  if(buf.readUInt32LE(lo)!==0x04034b50)fail('local header signature mismatch '+rel);
  const lnl=buf.readUInt16LE(lo+26),lel=buf.readUInt16LE(lo+28),lname=buf.subarray(lo+30,lo+30+lnl).toString('utf8').normalize('NFC');
  if(lname!==rel)fail('local/central filename mismatch '+rel);
  const start=lo+30+lnl+lel,end=start+cs;if(end>centralOffset)fail('compressed data overruns central directory '+rel);
  const comp=buf.subarray(start,end),raw=method===8?inflateRawSync(comp):Buffer.from(comp);
  if(raw.length!==us||crc32(raw)!==crc)fail('ZIP data integrity failed '+rel);
  out.push({rel,data:raw,sha256:sha256(raw)});p+=46+nl+el+cl;
 }
 if(p!==centralOffset+centralSize)fail('central directory size mismatch');
 assertPortablePathCollisions(out.map(x=>x.rel));const names=new Set();
 for(const x of out){if(names.has(x.rel))fail('duplicate ZIP entry '+x.rel);names.add(x.rel);}
 return out;
}
