import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createService, evaluateDetectors } from '../dist/js/service.js';

const bundle = JSON.parse(fs.readFileSync(new URL('../dist/data-v2/bundle.json', import.meta.url)));
const service = createService(bundle);
const historical = { mode: 'historical_review', generation: 0 };
const real = service.getIncident('AF-104', historical);
const at = cutoffUs => ({ mode: 'capture_replay', cutoffUs, generation: 1 });

test('independent full input inventory and channel assignments', () => {
  assert.equal(service.manifest.observationCount, 1_118_853);
  assert.equal(service.manifest.byteLength, 286_274_178);
  assert.equal(service.manifest.retryCount, 54_544);
  assert.equal(service.manifest.rejectedRecordCount, 0);
  assert.deepEqual(service.manifest.sources.map(s => s.channel), [36, 40, 44, 48, 149, 153, 157, 161]);
  assert(service.manifest.sources.every(s => s.sha256.length === 64 && s.health === 'unknown' && s.clock === 'unverified'));
});

test('real anchors preserve exact time, source, type, metadata and provenance', () => {
  assert.equal(real.anchors.deauth.id, 'S03-5099');
  assert.equal(real.anchors.auth.id, 'S03-6132');
  assert.equal(real.anchors.association.id, 'S03-6135');
  assert.equal(real.anchors.deauth.timeUs, 1789561528328446);
  assert.equal(real.anchors.auth.timeUs, 1789561541454175);
  assert.equal(real.anchors.association.timeUs, 1789561541455330);
  assert.equal(real.durationUs, 13_126_884);
  assert.equal(real.anchors.deauth.reasonCode, 23);
  assert.equal(real.anchors.deauth.signal, -75);
  assert.equal(real.anchors.deauth.noise, -96);
  assert.equal(real.anchors.auth.authAlgorithm, 0);
  assert.equal(real.anchors.auth.authTransaction, 2);
  assert.equal(real.anchors.auth.statusCode, 0);
  assert.equal(real.anchors.association.statusCode, 0);
  for (const frame of Object.values(real.anchors)) {
    assert.equal(frame.source, 'S03'); assert.equal(frame.channel, 44);
    assert.equal(frame.transmitter, 'AP-04'); assert.equal(frame.receiver, 'C-004');
    assert.equal(frame.rate, 6); assert.equal(frame.protected, false); assert.equal(frame.retry, false);
    assert.equal(frame.observationId, `${frame.captureHash}:${frame.frameNumber}`);
  }
});

test('complete exact 46/10 memberships, source subtotals and count semantics', () => {
  const retries = service.queryEvidence('AF-104', { selection: 'retry' }, historical);
  const probes = service.queryEvidence('AF-104', { selection: 'probes' }, historical);
  const count = rows => Object.fromEntries(service.manifest.sources.map(s => [s.id, rows.filter(e => e.source === s.id).length]));
  assert.equal(retries.total, 46); assert.equal(probes.total, 10);
  assert.deepEqual(count(retries.rows), { S01: 14, S02: 12, S03: 5, S04: 3, S05: 5, S06: 2, S07: 4, S08: 1 });
  assert.deepEqual(count(probes.rows), { S01: 0, S02: 0, S03: 4, S04: 4, S05: 2, S06: 0, S07: 0, S08: 0 });
  assert.equal(real.viewpoints, 8); assert.equal(real.probeViewpoints, 3);
  assert.deepEqual(retries.rows.map(e => e.id), bundle.incidents[0].audit.retryIds);
  assert.deepEqual(probes.rows.map(e => e.id), bundle.incidents[0].audit.probeIds);
  assert(service.queryEvidence('AF-104', {}, historical).total > 46);
});

test('other curated cases are raw-verified, not screenshot fixtures', () => {
  assert.equal(service.getIncident('AF-105').durationUs, 13_120_847);
  assert.equal(service.getIncident('AF-105').retryCount, 45);
  assert.equal(service.getIncident('AF-106').durationUs, 13_102_418);
  assert.equal(service.getIncident('AF-106').probeCount, 6);
});

test('strict replay prefix across opening, watch, auth and association boundaries', () => {
  assert.equal(service.getIncident('AF-104', at(real.openUs - 1)), null);
  const opening = service.getIncident('AF-104', at(real.openUs));
  assert.equal(opening.durationUs, null); assert.equal(opening.retryCount, 0);
  assert.equal(opening.anchors.auth, null); assert.equal(opening.anchors.association, null);
  assert.equal(opening.lifecycle, 'observing');
  assert.equal(service.getIncident('AF-104', at(real.openUs + 4_999_999)).lifecycle, 'observing');
  assert.equal(service.getIncident('AF-104', at(real.openUs + 5_000_000)).lifecycle, 'investigating');
  const auth = service.getIncident('AF-104', at(real.authUs));
  assert.equal(auth.retryCount, 46); assert.equal(auth.durationUs, null);
  assert.equal(auth.anchors.association, null);
  assert.equal(service.getIncident('AF-104', at(real.endUs)).durationUs, 13_126_884);
  assert.throws(() => service.getFrame('S03-6135', at(real.endUs - 1)), { code: 'outside_replay_cutoff' });
  assert(!service.answer('AF-104', 'What does the duration measure?', at(real.openUs)).text.includes('13.127'));
  assert(!JSON.stringify(service.queryEvidence('AF-104', {}, at(real.openUs))).includes('S03-6135'));
});

test('seek reversal, immutable snapshot and speed-independent prefix projections', () => {
  const snapshot = service.getIncident('AF-104', at(real.openUs));
  const completed = service.getIncident('AF-104', at(real.endUs));
  assert.equal(snapshot.durationUs, null); assert.equal(completed.durationUs, 13_126_884);
  assert.deepEqual(service.getIncident('AF-104', at(real.openUs)), snapshot);
  for (const speed of [1, 5, 20]) assert.deepEqual(service.getIncident('AF-104', { ...at(real.endUs), speed }), completed);
  completed.evidence.length = 0;
  assert(service.getIncident('AF-104', at(real.endUs)).evidence.length > 0);
});

test('pagination has no gaps/duplicates, scoped filter counts and stale rejection', () => {
  const all = service.queryEvidence('AF-104', { pageSize: 500 });
  const ids = [];
  for (let page = 0; page * 7 < all.total; page++) ids.push(...service.queryEvidence('AF-104', { page, pageSize: 7 }).rows.map(e => e.id));
  assert.deepEqual(ids, all.rows.map(e => e.id)); assert.equal(new Set(ids).size, ids.length);
  assert.equal(service.queryEvidence('AF-104', { selection: 'retry', source: 'S01' }).total, 14);
  assert.throws(() => service.queryEvidence('AF-104', { pageSize: 501 }), { code: 'invalid_filter' });
  assert.throws(() => service.queryEvidence('AF-104', { source: 'S99' }), { code: 'invalid_filter' });
  const cursor = service.queryEvidence('AF-104', { pageSize: 1 }, at(real.endUs)).nextCursor;
  assert.equal(service.queryEvidence('AF-104', { cursor }, at(real.endUs)).page, 1);
  assert.equal(service.queryEvidence('AF-104', { cursor }, at(real.endUs)).pageSize, 1);
  assert.throws(() => service.queryEvidence('AF-104', { cursor, pageSize: 2 }, at(real.endUs)), { code: 'stale_generation' });
  assert.throws(() => service.queryEvidence('AF-104', { cursor }, { mode: 'historical_review', cutoffUs: real.endUs, generation: 1 }), { code: 'stale_generation' });
  assert.throws(() => service.queryEvidence('AF-104', { cursor }, at(real.openUs)), { code: 'stale_generation' });
});

test('every contextual citation resolves at the admitted cutoff; unknown stays bounded', () => {
  for (const question of ['Summarize sequence', 'What does the duration measure?', 'Why reason 23?', 'Explain retry count', 'Source coverage', 'What evidence is needed next?']) {
    for (const cutoff of [real.openUs, real.authUs, real.endUs]) {
      const answer = service.answer('AF-104', question, at(cutoff));
      assert.equal(answer.supported, true);
      for (const id of answer.citations) assert(service.getFrame(id, at(cutoff)).timeUs <= cutoff);
    }
  }
  assert.equal(service.answer('AF-104', 'What is the weather?').supported, false);
  assert.deepEqual(service.answer('AF-104', 'What is the weather?').citations, []);
});

test('safe bundle privacy and corruption errors', () => {
  assert(!/\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b/i.test(JSON.stringify(bundle)));
  assert.throws(() => createService(null), { code: 'dataset_missing' });
  const broken = structuredClone(bundle); broken.events[0].captureHash = 'bad';
  assert.throws(() => createService(broken), { code: 'capture_hash_mismatch' });
  const missing = structuredClone(bundle); missing.events = missing.events.filter(e => e.id !== 'S03-5099');
  assert.throws(() => createService(missing), { code: 'evidence_unavailable' });
});

const synth = (n, timeUs, more = {}) => ({ id: `S01-${n}`, frameNumber: n, timeUs, source: 'S01',
  type: 'Probe response', channel: 36, transmitter: 'AP-01', receiver: 'C-001', bssid: 'AP-01', retry: false, ...more });
test('detector prefix equivalence, duplicate delivery and deterministic watch', () => {
  const events = [synth(1, 0, { type: 'Deauthentication' }), synth(2, 8_000_000),
    synth(3, 10_000_000, { type: 'Association response', statusCode: 0 })];
  for (const cutoff of [0, 4_999_999, 5_000_000, 8_000_000, 10_000_000]) {
    assert.deepEqual(evaluateDetectors(events, cutoff), evaluateDetectors(events.filter(e => e.timeUs <= cutoff), cutoff));
  }
  assert.equal(evaluateDetectors(events, 4_999_999).signals.filter(s => s.detector === 'D02').length, 0);
  assert.equal(evaluateDetectors(events, 5_000_000).signals.filter(s => s.detector === 'D02').length, 1);
  assert.equal(evaluateDetectors([events[0], events[0]], 0).episodes.length, 1);
  assert.equal(evaluateDetectors(events, 10_000_000).episodes[0].state, 'association_observed');
});

test('normal roam neutral; missing association is qualified; independent bursts do not suppress', () => {
  const normal = [synth(1, 0, { type: 'Deauthentication' }), synth(2, 10, { type: 'Association response', statusCode: 0 })];
  assert.equal(evaluateDetectors(normal, 20_000_000).signals.filter(s => s.detector === 'D02').length, 0);
  const absent = evaluateDetectors(normal.slice(0, 1), 20_000_000);
  assert.equal(absent.episodes[0].state, 'unresolved_at_end');
  assert(absent.signals[1].trigger.includes('observed'));
  const bursts = Array.from({ length: 24 }, (_, i) => synth(i + 1, i * 1000,
    { retry: true, transmitter: i % 2 ? 'AP-02' : 'AP-01' }));
  assert.equal(evaluateDetectors(bursts, 30_000).signals.filter(s => s.detector === 'D03').length, 2);
  const repeat = [...Array.from({ length: 12 }, (_, i) => synth(i + 1, i * 1000, { retry: true })),
    ...Array.from({ length: 12 }, (_, i) => synth(i + 13, 10_000_000 + i * 1000, { retry: true }))];
  assert.equal(evaluateDetectors(repeat, 11_000_000).signals.filter(s => s.detector === 'D03').length, 2);
});

test('client-centered multi-BSSID evidence preserves relationship without inventing same-BSSID recovery', () => {
  const events = [synth(1, 0, { type: 'Deauthentication' }),
    synth(2, 2_000_000, { type: 'Association response', statusCode: 0, bssid: 'AP-02', transmitter: 'AP-02' })];
  const result = evaluateDetectors(events, 3_000_000);
  assert.deepEqual(result.episodes[0].bssidContexts, ['AP-01', 'AP-02']);
  assert.equal(result.episodes[0].associationId, null);
  assert.equal(result.episodes[0].relatedAssociations[0].frameId, 'S01-2');
  assert.equal(result.episodes[0].relatedAssociations[0].provesSameBssidRecovery, false);
  assert(result.episodes[0].evidenceIds.includes('S01-2'));
});

test('D03 requires two complete low-count windows to rearm, with independent channel scopes', () => {
  const burst = (start, offset, channel = 36) => Array.from({ length: 12 }, (_, i) => synth(offset + i, start + i, { retry: true, channel }));
  const close = [...burst(0, 1), ...burst(4_000_000, 13)];
  assert.equal(evaluateDetectors(close, 5_000_000).signals.filter(s => s.detector === 'D03').length, 1);
  const far = [...burst(0, 1), ...burst(6_000_020, 13)];
  assert.equal(evaluateDetectors(far, 7_000_000).signals.filter(s => s.detector === 'D03').length, 2);
  const channels = [...burst(0, 1), ...burst(1_000, 13, 40)];
  assert.equal(evaluateDetectors(channels, 2_000).signals.filter(s => s.detector === 'D03').length, 2);
});

test('optional global release ordinal gates equal-timestamp frames and every read path', () => {
  const fixture = structuredClone(bundle);
  fixture.events = Object.values(real.anchors).map((f, i) => ({ ...f, timeUs: real.openUs, releaseOrdinal: i + 1 }));
  fixture.incidents = [{ ...fixture.incidents[0], evidenceIds: fixture.events.map(f => f.id) }];
  const sameTime = createService(fixture);
  const context = { ...at(real.openUs), releaseOrdinal: 1 };
  assert.equal(sameTime.getIncident('AF-104', context).anchors.auth, null);
  assert.equal(sameTime.queryEvidence('AF-104', {}, context).total, 1);
  assert.throws(() => sameTime.getFrame('S03-6132', context), { code: 'outside_replay_cutoff' });
  assert.equal(sameTime.answer('AF-104', 'duration', context).citations.length, 1);
  assert.equal(sameTime.getIncident('AF-104', { ...context, releaseOrdinal: 3 }).durationUs, 0);
  assert.equal(sameTime.getIncident('AF-104', { ...context, releaseOrdinal: 0 }), null);
});

test('parser adversarial synthetic fixtures: radiotap, management, protected, DS and control', () => {
  const result = spawnSync('../.analysis-env/bin/python', ['-c', `
import importlib.util, struct, tempfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('ingest','scripts/build_evidence.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
rt=bytes.fromhex('0000080000000000')
a=bytes.fromhex('001122334455'); b=bytes.fromhex('102132435465'); c=bytes.fromhex('203142536475'); d=bytes.fromhex('304152637485')
def frame(fc,body=b''):
 return rt+struct.pack('<HH',fc,1)+a+b+c+struct.pack('<H',16)+body
for raw in [b'',bytes.fromhex('0000ffff00000000')]:
 try: m.decode(raw); raise AssertionError('malformed accepted')
 except ValueError: pass
assert 'truncated_management_parameters' in m.decode(frame(0xc0))['missingReasons']
assert m.decode(frame(0x40c0,b'\\x17\\x00'))['reasonCode'] is None
for fc,expected in [(0x0008,m.address(c)),(0x0108,m.address(a)),(0x0208,m.address(b)),(0x0308,None)]:
 e=m.decode(frame(fc,d)); assert e['bssid']==expected
assert m.decode(rt+struct.pack('<HH',0xb4,1)+a+b)['transmitter']==m.address(b)
assert m.decode(rt+struct.pack('<HH',0xd4,1)+a)['transmitter'] is None
unsupported=bytes.fromhex('0000080000000001')+frame(0xc0,b'\\x17\\x00')[8:]
assert 'unsupported_radiotap_field' in m.decode(unsupported)['missingReasons']
for endian,magic in [('<',b'\\xd4\\xc3\\xb2\\xa1'),('>',b'\\xa1\\xb2\\xc3\\xd4')]:
 with tempfile.TemporaryDirectory() as temporary:
  path=Path(temporary)/'synthetic.pcap'; raw=frame(0xc0,b'\\x17\\x00')
  path.write_bytes(magic+struct.pack(endian+'HHIIII',2,4,0,0,65535,127)+struct.pack(endian+'IIII',1,123456,len(raw),len(raw))+raw)
  assert list(m.records(path))[0][2]==1123456
print('synthetic parser fixtures passed')
`], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
