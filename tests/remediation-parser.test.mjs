import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('Security parser minimizes identity bytes, respects protection and bounds malformed EAP',()=>{
  const result=spawnSync(process.env.AIRFRAME_PYTHON||'python3',['-c',String.raw`
import importlib.util, struct, json
spec=importlib.util.spec_from_file_location('ingest','scripts/build_evidence.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
rt=bytes.fromhex('0000080000000000')
a=bytes.fromhex('001122334455'); b=bytes.fromhex('102132435465'); c=bytes.fromhex('203142536475')
llc=bytes.fromhex('aaaa03000000888e')
def data(body,protected=False,qos=False,declared=None):
 fc=0x0008|(0x4000 if protected else 0)|(0x0080 if qos else 0)
 header=struct.pack('<HH',fc,1)+a+b+c+struct.pack('<H',16)+(b'\0\0' if qos else b'')
 return rt+header+llc+struct.pack('!BBH',2,0,len(body) if declared is None else declared)+body
identity=b'private.employee@example.invalid'
body=struct.pack('!BBH',2,17,5+len(identity))+bytes([1])+identity
for qos in [False,True]:
 s=m.decode(data(body,qos=qos))['security']
 assert s['state']=='parsed' and s['protocol']=='EAP' and s['identifier']==17 and s['eapType']==1
 assert identity.decode() not in json.dumps(s)
 assert set(s)<=set(['state','protocol','version','packetType','code','identifier','eapType','label'])
assert m.decode(data(body,protected=True))['security']['state']=='protected'
assert m.decode(data(body,declared=len(body)+10))['security']['state']=='truncated'
for invalid in [struct.pack('!BBH',2,17,3),struct.pack('!BBH',2,17,200)]:
 assert m.decode(data(invalid))['security']['state']=='malformed'
for code in [1,2]:
 assert m.decode(data(struct.pack('!BBH',code,17,4)))['security']['state']!='parsed','Request/Response without mandatory Type accepted'
for code in [3,4]:
 s=m.decode(data(struct.pack('!BBH',code,17,4)))['security']; assert s['state']=='parsed' and s['code']==code
print('Minimization, protected, truncated and EAP length fixtures passed')
`],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
});
