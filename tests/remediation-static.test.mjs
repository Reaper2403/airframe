import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';

async function walk(root){const result=[];for(const e of await readdir(root,{withFileTypes:true})){const p=resolve(root,e.name);result.push(...(e.isDirectory()?await walk(p):[p]));}return result;}
const publicFiles=await walk('dist');

test('Every published JSON artifact excludes direct identifiers and raw security payload fields',async()=>{
  const forbiddenKeys=new Set(['rawMac','rawSSID','rawSsid','eapIdentity','identityText','identityValue','identityPayload','rawPayload','packetBytes','payloadBytes']);
  function inspect(value,path){
    if(typeof value==='string'){
      assert.doesNotMatch(value,/\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b/i,`Raw MAC: ${path}`);
      assert.doesNotMatch(value,/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,`Identity-like address: ${path}`);
    }else if(value&&typeof value==='object'){
      for(const [key,item] of Object.entries(value)){
        assert.ok(!forbiddenKeys.has(key)||item==null,`Prohibited publication field: ${path}.${key}`);
        inspect(item,`${path}.${key}`);
      }
    }
  }
  for(const path of publicFiles.filter(p=>p.endsWith('.json')))inspect(JSON.parse(await readFile(path,'utf8')),path);
});

test('All advertised evidence partitions resolve to exact bytes and digest',async()=>{
  let checked=0;
  for(const manifestPath of publicFiles.filter(p=>p.endsWith('partition-manifest.json'))){
    const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
    for(const part of manifest.partitions||[]){
      const file=resolve(dirname(manifestPath),part.path);
      assert.ok(file.startsWith(resolve('dist')+'/'),'Partition path escapes published root');
      const bytes=await readFile(file);
      assert.equal(bytes.byteLength,part.byteLength,part.path);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),part.sha256,part.path);
      checked++;
    }
  }
  assert.ok(checked>0,'No integrity-checked evidence partitions found');
});

test('No individual static evidence artifact is a million-row monolithic payload',async()=>{
  for(const path of publicFiles.filter(p=>p.endsWith('.json'))){
    assert.ok((await stat(path)).size<20_000_000,`Oversized evidence artifact: ${path}`);
    const value=JSON.parse(await readFile(path,'utf8'));
    for(const key of ['events','observations','rows'])if(Array.isArray(value[key]))assert.ok(value[key].length<1_000_000,`${path} embeds full raw-scale rows`);
  }
});
