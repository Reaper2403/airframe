#!/usr/bin/env python3
"""Reproducible, header-only AIRFRAME ingestion. Raw captures are never modified."""
from __future__ import annotations

import hashlib
import json
import sqlite3
import struct
import subprocess
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PARSER = "airframe-header-2.0"
EXPECTED = [
    "130b9aa382afd8c71cdf6c1960c62b01009ba48ba6a4a76e13852bfeb93b8320",
    "79bd7f8dd518ea716dbeb0823da5335650716609079d3226a15429b1b2528270",
    "0c7835e1f52281100849a081ee9e3a9ba1e01a283df80cbcdbb619dcdcc3df75",
    "f481ed7d21743f03bdee310aa8b769ba178150c599c75a76b9b3787e6cae2aff",
    "ed71261e70fa057cdf8de33f57d68cc5faa4ed22783886ec116a39e438330db9",
    "39f936baf1e309b9b9becc3401e82b07be179b9a5da68473f7ee575199008946",
    "e1c82e966c75fc4513f442e4e7072943f6792c0125dd2581adf7ace33d38fc96",
    "1a42cdc453e45da7cffab478aa96e1be50cef4c09608d5b94c23115ddf214ba6",
]
TYPES = {(0, 0): "Association request", (0, 1): "Association response",
         (0, 2): "Reassociation request", (0, 3): "Reassociation response",
         (0, 4): "Probe request", (0, 5): "Probe response", (0, 8): "Beacon",
         (0, 10): "Disassociation", (0, 11): "Authentication",
         (0, 12): "Deauthentication", (0, 13): "Action", (1, 11): "RTS",
         (1, 12): "CTS", (1, 13): "ACK", (2, 0): "Data", (2, 4): "Null data",
         (2, 8): "QoS data", (2, 12): "QoS null"}
# Only fixed-size, known radiotap fields are decoded. Unsupported fields stop
# field traversal instead of corrupting later offsets. The 802.11 offset is
# independently bounded by the radiotap header length.
RT = {0: (8, 8), 1: (1, 1), 2: (1, 1), 3: (2, 4), 4: (2, 2),
      5: (1, 1), 6: (1, 1), 7: (2, 2), 8: (2, 2), 9: (2, 2),
      10: (1, 1), 11: (1, 1), 12: (1, 1), 13: (1, 1), 14: (2, 2),
      15: (2, 2), 16: (1, 1), 17: (1, 1), 18: (4, 8), 19: (1, 3),
      20: (4, 8), 21: (2, 12)}
LIMITATIONS = ["Cross-source clock alignment unverified.",
               "Sensor health and capture loss unavailable.",
               "Association response does not establish application recovery.",
               "Factory geometry and placements are illustrative.",
               "EAP/802.1X and advanced PHY analysis not implemented."]
CASES = [("AF-104", "S03-5099", "S03-6132", "S03-6135"),
         ("AF-105", "S04-5211", "S04-6256", "S04-6257"),
         ("AF-106", "S07-4663", "S07-5529", "S07-5530")]


def records(path):
    with path.open("rb") as stream:
        header = stream.read(24)
        endian = {b"\xd4\xc3\xb2\xa1": "<", b"\xa1\xb2\xc3\xd4": ">"}.get(header[:4])
        if len(header) != 24 or endian is None:
            raise ValueError("unsupported_format: requires classic microsecond PCAP")
        if struct.unpack_from(endian + "I", header, 20)[0] != 127:
            raise ValueError("unsupported_format: requires radiotap link type 127")
        ordinal = 0
        while True:
            offset = stream.tell()
            h = stream.read(16)
            if not h:
                break
            if len(h) != 16:
                raise ValueError("parse_incomplete: truncated PCAP record header")
            sec, usec, caplen, wirelen = struct.unpack(endian + "IIII", h)
            if usec >= 1_000_000 or caplen > 16_777_216:
                raise ValueError("parse_incomplete: invalid timestamp or record size")
            raw = stream.read(caplen)
            if len(raw) != caplen:
                raise ValueError("parse_incomplete: truncated PCAP record")
            ordinal += 1
            yield ordinal, offset, sec * 1_000_000 + usec, wirelen, raw


def address(value):
    return ":".join(f"{n:02x}" for n in value) if len(value) == 6 else None


def decode(raw):
    if len(raw) < 8 or raw[0] != 0:
        raise ValueError("malformed_radiotap")
    length = struct.unpack_from("<H", raw, 2)[0]
    if length < 8 or length > len(raw):
        raise ValueError("malformed_radiotap_length")
    words, pos = [], 4
    while True:
        if pos + 4 > length:
            raise ValueError("malformed_radiotap_bitmap")
        word = struct.unpack_from("<I", raw, pos)[0]
        words.append(word)
        pos += 4
        if not word & (1 << 31):
            break
    values, missing, stop = {}, [], False
    for wi, word in enumerate(words):
        for bit in range(31):
            if not word & (1 << bit):
                continue
            field = wi * 32 + bit
            if field not in RT:
                missing.append("unsupported_radiotap_field")
                stop = True
                break
            align, size = RT[field]
            pos += (-pos) % align
            if pos + size > length:
                missing.append("truncated_radiotap_field")
                stop = True
                break
            values[field] = raw[pos:pos + size]
            pos += size
        if stop:
            break
    d = raw[length:]
    if len(d) < 10:
        raise ValueError("truncated_80211_header")
    fc, duration = struct.unpack_from("<HH", d)
    typ, sub = (fc >> 2) & 3, (fc >> 4) & 15
    to_ds, from_ds = bool(fc & 0x100), bool(fc & 0x200)
    protected = bool(fc & 0x4000)
    ra, ta, sa, da, bssid = address(d[4:10]), None, None, None, None
    seq, frag = None, None
    if typ in (0, 2):
        if len(d) < 24:
            raise ValueError("truncated_80211_address_header")
        ta, a3 = address(d[10:16]), address(d[16:22])
        sc = struct.unpack_from("<H", d, 22)[0]
        seq, frag = sc >> 4, sc & 15
        if typ == 0 or (not to_ds and not from_ds):
            sa, da, bssid = ta, ra, a3
        elif to_ds and not from_ds:
            sa, da, bssid = ta, a3, ra
        elif from_ds and not to_ds:
            sa, da, bssid = a3, ra, ta
        elif len(d) >= 30:
            sa, da = address(d[24:30]), a3
        else:
            missing.append("truncated_four_address_header")
    elif typ == 1 and sub in (8, 9, 10, 11, 14, 15):
        ta = address(d[10:16])
        if ta is None:
            missing.append("truncated_control_transmitter")
    reason = status = algorithm = transaction = None
    if typ == 0 and not protected:
        body = d[24:]
        required = 6 if sub == 11 else 4 if sub in (1, 3) else 2 if sub in (10, 12) else 0
        if len(body) < required:
            missing.append("truncated_management_parameters")
        elif sub == 11:
            algorithm, transaction, status = struct.unpack_from("<HHH", body)
        elif sub in (1, 3):
            status = struct.unpack_from("<H", body, 2)[0]
        elif sub in (10, 12):
            reason = struct.unpack_from("<H", body)[0]
    elif typ == 0 and protected:
        missing.append("protected_management_body")
    freq = struct.unpack_from("<H", values[3])[0] if 3 in values else None
    channel = ((freq - 5000) // 5 if freq and 5000 < freq < 5900 else
               (freq - 2407) // 5 if freq and 2412 <= freq <= 2472 else
               14 if freq == 2484 else None)
    return dict(type=TYPES.get((typ, sub), f"Type {typ}/{sub}"), frameType=typ,
                frameSubtype=sub, transmitter=ta, receiver=ra, bssid=bssid,
                sourceAddress=sa, destinationAddress=da, sequence=seq, fragment=frag,
                retry=bool(fc & 0x800), protected=protected, toDs=to_ds, fromDs=from_ds,
                durationId=duration, durationInterpretation="duration_or_id_raw",
                frequency=freq, channel=channel,
                signal=struct.unpack("b", values[5])[0] if 5 in values else None,
                noise=struct.unpack("b", values[6])[0] if 6 in values else None,
                rate=values[2][0] / 2 if 2 in values else None,
                reasonCode=reason, statusCode=status, authAlgorithm=algorithm,
                authTransaction=transaction, parseState="partial" if missing else "valid",
                missingReasons=missing)


def compact(value):
    return json.dumps(value, separators=(",", ":"), sort_keys=True)


def main():
    sources, identities, bss_roles, client_roles = [], set(), set(), set()
    coverage, types = Counter(), Counter()
    total_retry, rejected = 0, 0
    paths = [ROOT / "data/raw" / f"sensor{n:02}.pcap" for n in range(1, 9)]
    for n, path in enumerate(paths):
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != EXPECTED[n]:
            raise ValueError(f"capture_hash_mismatch: S{n + 1:02}")
        counts, freq, retries, first, last = 0, Counter(), 0, None, None
        for ordinal, offset, time_us, wirelen, raw in records(path):
            counts += 1
            first = time_us if first is None else min(first, time_us)
            last = time_us if last is None else max(last, time_us)
            try:
                event = decode(raw)
            except ValueError:
                rejected += 1
                continue
            types[event["type"]] += 1
            retries += event["retry"]
            freq[event["frequency"]] += 1
            for key in ("signal", "noise", "rate", "frequency", "reasonCode", "statusCode"):
                coverage[f"{key}:{'present' if event[key] is not None else 'unavailable'}"] += 1
            for key in ("transmitter", "receiver", "bssid", "sourceAddress", "destinationAddress"):
                if event[key]:
                    identities.add(event[key])
            if event["frameType"] == 0 and event["frameSubtype"] in (8, 1, 3, 5):
                if event["bssid"] and event["bssid"] != "ff:ff:ff:ff:ff:ff":
                    bss_roles.add(event["bssid"])
                if event["frameSubtype"] in (1, 3):
                    client_roles.add(event["receiver"])
            if event["frameType"] == 0 and event["frameSubtype"] in (0, 2, 4):
                client_roles.add(event["transmitter"])
        main_freq = freq.most_common(1)[0][0]
        sources.append(dict(id=f"S{n + 1:02}", fileName=path.name, sha256=digest,
                            byteLength=path.stat().st_size, recordCount=counts,
                            retryCount=retries, firstUs=first, lastUs=last,
                            frequency=main_freq, channel=(main_freq - 5000) // 5,
                            frequencies=dict(freq), health="unknown", clock="unverified",
                            linkType=127, timestampResolution="microsecond", location=None))
        total_retry += retries
        print(f"Audited {sources[-1]['id']}: {counts:,} records", flush=True)
    aliases = {"ff:ff:ff:ff:ff:ff": "Broadcast"}
    for suffix in (4, 5, 8):
        aliases[f"3c:58:c2:00:00:{suffix:02x}"] = f"C-{suffix:03}"
        aliases[f"00:0b:86:{suffix:02x}:00:00"] = f"AP-{suffix:02}"
    for prefix, members, width in (("AP", bss_roles, 2), ("C", client_roles - bss_roles, 3),
                                    ("A", identities - bss_roles - client_roles, 3)):
        index = 1
        for identity in sorted(x for x in members if x and x not in aliases):
            while f"{prefix}-{index:0{width}}" in aliases.values():
                index += 1
            aliases[identity] = f"{prefix}-{index:0{width}}"
            index += 1
    dataset_id = "airframe-" + hashlib.sha256("".join(EXPECTED).encode()).hexdigest()[:16]
    manifest = dict(datasetId=dataset_id, schemaVersion="2.0", parserVersion=PARSER,
                    detectorVersion="deterministic-2.0", aliasVersion="2.0",
                    origin="supplied_capture", sources=sources,
                    firstUs=min(s["firstUs"] for s in sources),
                    lastUs=max(s["lastUs"] for s in sources),
                    observationCount=sum(s["recordCount"] for s in sources),
                    retryCount=total_retry, byteLength=sum(s["byteLength"] for s in sources),
                    rejectedRecordCount=rejected, fieldCoverage=dict(coverage),
                    frameTypes=dict(types), limitations=LIMITATIONS,
                    capabilities={"historicalReview": True, "captureReplay": True,
                                  "liveFeed": False, "physicalLocation": False,
                                  "applicationRecovery": False, "eapAnalysis": False})
    assert manifest["observationCount"] == 1_118_853
    assert manifest["byteLength"] == 286_274_178
    assert total_retry == 54_544
    (ROOT / "data/identity-registry-v2.json").write_text(compact({"version": "2.0", "mapping": aliases}))
    (ROOT / "data/identity-registry-v2.json").chmod(0o600)
    db = sqlite3.connect(ROOT / "data/normalized-v2.sqlite")
    db.executescript("DROP TABLE IF EXISTS observations; CREATE TABLE observations (id TEXT PRIMARY KEY, time_us INTEGER, source TEXT, frame_number INTEGER, type TEXT, transmitter TEXT, receiver TEXT, bssid TEXT, retry INTEGER, data TEXT);")
    for path, source in zip(paths, sources):
        batch = []
        for ordinal, offset, time_us, wirelen, raw in records(path):
            try:
                event = decode(raw)
            except ValueError as error:
                event = {"type": "Unparsed", "transmitter": None, "receiver": None,
                         "bssid": None, "retry": None, "parseState": "malformed",
                         "missingReasons": [str(error)]}
            for key in ("transmitter", "receiver", "bssid", "sourceAddress", "destinationAddress"):
                if event.get(key):
                    event[key] = aliases[event[key]]
            event.update(id=f"{source['id']}-{ordinal}",
                         observationId=f"{source['sha256']}:{ordinal}",
                         source=source["id"], frameNumber=ordinal, fileOffset=offset,
                         captureHash=source["sha256"], timeUs=time_us, caplen=len(raw),
                         wirelen=wirelen, parserVersion=PARSER,
                         ingestionTimeUs=None, timestampUncertaintyUs=None)
            batch.append((event["id"], time_us, source["id"], ordinal, event["type"],
                          event["transmitter"], event["receiver"], event["bssid"],
                          event["retry"], compact(event)))
            if len(batch) == 2000:
                db.executemany("INSERT INTO observations VALUES (?,?,?,?,?,?,?,?,?,?)", batch)
                batch.clear()
        db.executemany("INSERT INTO observations VALUES (?,?,?,?,?,?,?,?,?,?)", batch)
        db.commit()
        print(f"Indexed {source['id']}", flush=True)
    db.executescript("CREATE INDEX event_order ON observations(time_us,source,frame_number); CREATE INDEX receiver_time ON observations(receiver,time_us); CREATE INDEX transmitter_time ON observations(transmitter,time_us); CREATE INDEX event_type ON observations(type,time_us);")
    bundle = {"manifest": manifest, "incidents": [], "events": [],
              "selectionKind": "complete_curated_client_episode_windows",
              "curated": True, "exhaustiveIncidentList": False}
    unique = {}
    for incident_id, opening_id, auth_id, association_id in CASES:
        anchors = [json.loads(db.execute("SELECT data FROM observations WHERE id=?", (key,)).fetchone()[0])
                   for key in (opening_id, auth_id, association_id)]
        opening, auth, association = anchors
        client, ap = opening["receiver"], opening["bssid"]
        assert opening["type"] == "Deauthentication" and opening["reasonCode"] == 23
        assert opening["transmitter"] == ap
        assert auth["type"] == "Authentication" and auth["statusCode"] == 0 and auth["authTransaction"] == 2
        assert association["type"] == "Association response" and association["statusCode"] == 0
        assert all(e["receiver"] == client and e["bssid"] == ap and e["source"] == opening["source"] for e in anchors)
        # Fixed causal episode horizon: never use a future endpoint to choose
        # the context population. Include post-association observations too.
        rows = db.execute("SELECT data FROM observations WHERE time_us BETWEEN ? AND ? AND (transmitter=? OR receiver=?) ORDER BY time_us,source,frame_number",
                          (opening["timeUs"], opening["timeUs"] + 20_000_000, client, client))
        events = [json.loads(row[0]) for row in rows]
        metrics = [e for e in events if e["timeUs"] <= auth["timeUs"]]
        retry = [e for e in metrics if e["type"] == "Probe response" and e["retry"] and e["receiver"] == client]
        probes = [e for e in metrics if e["type"] == "Probe request" and e["transmitter"] == client]
        item = dict(id=incident_id, client=client, ap=ap, openingId=opening_id,
                    authId=auth_id, associationId=association_id, openUs=opening["timeUs"],
                    windowEndUs=opening["timeUs"] + 20_000_000,
                    evidenceIds=[e["id"] for e in events],
                    audit={"durationUs": association["timeUs"] - opening["timeUs"],
                           "retryIds": [e["id"] for e in retry], "probeIds": [e["id"] for e in probes],
                           "retryBySource": dict(Counter(e["source"] for e in retry)),
                           "probesBySource": dict(Counter(e["source"] for e in probes))})
        if incident_id == "AF-104":
            assert item["audit"]["durationUs"] == 13_126_884
            assert len(retry) == 46 and len(probes) == 10
            assert item["audit"]["retryBySource"] == {"S01": 14, "S02": 12, "S03": 5, "S04": 3, "S05": 5, "S06": 2, "S07": 4, "S08": 1}
        bundle["incidents"].append(item)
        unique.update({e["id"]: e for e in events})
        print(f"Verified {incident_id}: {item['audit']['durationUs']} us, {len(retry)} retries, {len(probes)} probes", flush=True)
    # Global ordinal is assigned from the complete dataset, not the curated
    # subset. It permits an exact release boundary within equal timestamps.
    for release_ordinal, row in enumerate(db.execute("SELECT id FROM observations ORDER BY time_us,source,frame_number"), 1):
        if row[0] in unique:
            unique[row[0]]["releaseOrdinal"] = release_ordinal
    bundle["events"] = sorted(unique.values(), key=lambda e: (e["timeUs"], e["source"], e["frameNumber"]))
    out = ROOT / "dist/data-v2"
    out.mkdir(parents=True, exist_ok=True)
    serialized = compact(bundle)
    import re
    assert not re.search(r"\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b", serialized)
    (out / "bundle.json").write_text(serialized)
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2))
    (out / "partition-manifest.json").write_text(json.dumps({
        "datasetId": dataset_id, "partitions": [{"path": "bundle.json",
        "sha256": hashlib.sha256(serialized.encode()).hexdigest(),
        "byteLength": len(serialized.encode()), "recordCount": len(bundle["events"]),
        "kind": bundle["selectionKind"], "completeDataset": False,
        "firstUs": bundle["events"][0]["timeUs"], "lastUs": bundle["events"][-1]["timeUs"]}],
        "fullNormalizedStore": "local-only indexed SQLite; not served to browser"}, indent=2))
    db.close()
    print(f"Bundle: {len(bundle['events'])} selected observations; {len(serialized):,} bytes", flush=True)
    # Evaluate the identical pure JavaScript detector used by service tests over
    # the complete indexed dataset, streamed in canonical order. The resulting
    # append-only histories remain local: the UI is an explicitly curated view.
    subprocess.run(["node", "--input-type=module", "-e", """
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import { evaluateDetectors } from './dist/js/service.js';
const db = new DatabaseSync('data/normalized-v2.sqlite', {readOnly:true});
const cutoff = db.prepare('SELECT max(time_us) AS t FROM observations').get().t;
function* observations() {
  for (const row of db.prepare('SELECT data FROM observations ORDER BY time_us,source,frame_number').iterate()) yield JSON.parse(row.data);
}
const result = evaluateDetectors(observations(), cutoff);
writeFileSync('data/detector-audit-v2.json', JSON.stringify(result));
console.log('Full detector audit:',result.releaseOrdinal,'observations;',result.episodes.length,'episodes;',Object.fromEntries(['D01','D02','D03'].map(d=>[d,result.signals.filter(s=>s.detector===d).length])));
db.close();
"""], cwd=ROOT, check=True)


if __name__ == "__main__":
    main()
