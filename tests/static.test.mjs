import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {execFileSync} from 'node:child_process';
async function files(root){const out=[];for(const entry of await readdir(root,{withFileTypes:true})){const path=resolve(root,entry.name);out.push(...(entry.isDirectory()?await files(path):[path]));}return out;}
test('Published files exclude raw identities, captures, restricted mappings and legacy data',async()=>{
 for(const file of await files('dist')){
  assert.ok(!/\.(pcap|sqlite|db)$/.test(file),file);assert.ok(!file.includes('identity-registry'),file);assert.ok(!file.includes('/dist/data/'),file);
  if(['.json','.js','.html','.css'].includes(extname(file))){const data=await readFile(file,'utf8');assert.ok(!/\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b/i.test(data),`Raw MAC in ${file}`);}
 }
});
test('JavaScript modules parse without syntax errors',async()=>{for(const file of await files('dist/js'))if(file.endsWith('.js'))execFileSync(process.execPath,['--check',file]);});
test('Local page dependencies exist and no third-party scripts load',async()=>{
 const html=await readFile('dist/index.html','utf8');assert.ok(!/<script[^>]+src=["']https?:/i.test(html));
 for(const [,href]of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g))assert.ok((await stat(resolve('dist',href))).isFile(),href);
});
test('Initial evidence payload stays bounded',async()=>assert.ok((await stat('dist/data-v2/bundle.json')).size<5_000_000));
