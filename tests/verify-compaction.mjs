import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../dist/data-v3/',import.meta.url);
const target=new URL('../test-results/remediation/pre-compaction-membership.json',import.meta.url);
const index=JSON.parse(await fs.readFile(new URL('index.json',root)));
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const result={clients:[],quality:[],audit:JSON.parse(await fs.readFile(new URL('audit.json',root)))};
for(const entry of index.clients){
 const data=JSON.parse(await fs.readFile(new URL(entry.path,root)));
 const events=data.events;
 assert.ok(Array.isArray(events),'Wire format must expose events or verifier needs documented decoder');
 const membership=events.map(e=>[e.id,e.timeUs,e.releaseOrdinal,e.source,e.frameNumber,e.captureHash,e.fileOffset,e.type,e.transmitter,e.receiver,e.bssid,e.reasonCode??null,e.statusCode??null,e.security??null]);
 result.clients.push({client:entry.client,count:membership.length,digest:digest(membership)});
}
const quality=JSON.parse(await fs.readFile(new URL(index.qualityPath,root)));
for(const finding of quality.findings){const hash=createHash('sha256');let count=0;for(const part of finding.partitions){const data=JSON.parse(await fs.readFile(new URL(part.path,root)));for(const packed of data.rows){let row=packed;if(data.encoding==='quality-delta-1'){assert.equal(data.bases.length,4);assert.equal(packed.length,8);row=[...packed.slice(0,4).map((value,i)=>value+data.bases[i]),...packed.slice(4,7),data.types[packed[7]]];assert.equal(typeof row[7],'string');}hash.update(JSON.stringify(row)+'\n');count++;}}result.quality.push({id:finding.id,count,digest:hash.digest('hex')});}
if(process.argv.includes('--record')){await fs.writeFile(target,JSON.stringify(result,null,2));console.log(`Recorded ${result.clients.length} client and ${result.quality.length} quality membership digests`);}
else{assert.deepEqual(result,JSON.parse(await fs.readFile(target)));console.log('All client membership/provenance/security and quality membership digests unchanged');}
