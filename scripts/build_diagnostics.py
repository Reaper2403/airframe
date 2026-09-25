#!/usr/bin/env python3
"""Publish allowlisted diagnostic metadata; raw inputs and identities stay local."""
import hashlib
import json
import re
import sqlite3
import struct
from collections import defaultdict, Counter
from pathlib import Path
from build_evidence import ROOT, EXPECTED, records, decode, compact

OUT = ROOT / "dist/data-v3"
FIELDS = "type frameType frameSubtype transmitter receiver bssid sourceAddress destinationAddress sequence fragment retry protected toDs fromDs durationId durationInterpretation frequency channel signal noise rate reasonCode statusCode authAlgorithm authTransaction parseState missingReasons security".split()

def publish(path, value):
    text = compact(value)
    if re.search(r"\b(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}\b", text):
        raise ValueError("Publication rejected: raw hardware identity")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    return hashlib.sha256(text.encode()).hexdigest()

def main():
    aliases = json.loads((ROOT / "data/identity-registry-v2.json").read_text())["mapping"]
    eligible_clients = {alias for raw,alias in aliases.items() if not int(raw[:2],16)&1 and not alias.startswith("AP-")}
    base = json.loads((ROOT / "dist/data-v2/bundle.json").read_text())
    curated = {e["id"]:e for e in base["events"]}
    db = sqlite3.connect(f"file:{ROOT / 'data/normalized-v2.sqlite'}?mode=ro", uri=True)
    ordinals = {row[0]: n for n, row in enumerate(db.execute("SELECT id FROM observations ORDER BY time_us,source,frame_number"), 1)}
    clients, quality, inventory, pattern_events, frame_lookup = defaultdict(list), [], {}, [], {}
    security_counts = Counter()
    quality_specs = {
        "timing": ("Timestamp validity anomalies", "Adjacent capture records that are both beacons have timestamps separated by at most 10 microseconds; recorded intervals are not validated physical latency.", ["physical_latency", "airtime", "retry_spacing", "utilization"]),
        "phy": ("Invalid 5 GHz PHY metadata", "A 5 GHz beacon reports a legacy rate below 6 Mb/s. Do not derive airtime or utilization.", ["airtime", "utilization"]),
        "snaplen": ("Included length exceeds declared snapshot", "Safely bounded record data exceeds the file's declared snapshot length. Permissive parsing retained provenance.", [])}
    for n, source in enumerate(base["manifest"]["sources"], 1):
        path = ROOT / "data/raw" / f"sensor{n:02}.pcap"
        if hashlib.sha256(path.read_bytes()).hexdigest() != EXPECTED[n-1]:
            raise ValueError("Capture hash mismatch")
        with path.open("rb") as stream:
            header = stream.read(24)
        endian = "<" if header[:4] == b"\xd4\xc3\xb2\xa1" else ">"
        snaplen = struct.unpack_from(endian + "I", header, 16)[0]
        anomalies = defaultdict(list)
        previous_beacon = None
        for ordinal, offset, timestamp, wirelen, raw in records(path):
            frame_id = f"{source['id']}-{ordinal}"
            try:
                parsed = decode(raw)
            except ValueError:
                continue
            e = {key: parsed.get(key) for key in FIELDS}
            for key in ("transmitter", "receiver", "bssid", "sourceAddress", "destinationAddress"):
                if e[key]:
                    e[key] = aliases.get(e[key], "Unmapped")
            e.update(id=frame_id, observationId=f"{source['sha256']}:{ordinal}", source=source["id"],
                     frameNumber=ordinal, fileOffset=offset, captureHash=source["sha256"], timeUs=timestamp,
                     caplen=len(raw), wirelen=wirelen, parserVersion="airframe-security-3.0",
                     releaseOrdinal=ordinals[frame_id], declaredSnaplen=snaplen)
            if frame_id in curated:
                curated[frame_id]["security"] = e["security"]
                curated[frame_id]["declaredSnaplen"] = snaplen
                curated[frame_id]["securityParserVersion"] = "airframe-security-3.0"
            flags = []
            if parsed["type"] == "Beacon":
                if previous_beacon is not None and 0 <= timestamp - previous_beacon <= 10:
                    flags.append("timing")
                previous_beacon = timestamp
                if parsed["frequency"] and parsed["frequency"] >= 5000 and parsed["rate"] is not None and parsed["rate"] < 6:
                    flags.append("phy")
                ap = e["bssid"]
                if ap and ap != "Broadcast":
                    if ap not in inventory:
                        publish(OUT / "frames" / f"{frame_id}.json", e)
                    item = inventory.setdefault(ap, {"ap": ap, "sources": set(), "sourceFirst":{}, "firstUs": timestamp, "lastUs": timestamp, "firstEvidence": frame_id, "firstOrdinal": e["releaseOrdinal"]})
                    item["sources"].add(source["id"])
                    item["sourceFirst"].setdefault(source["id"], [timestamp,e["releaseOrdinal"]])
                    item["lastUs"] = timestamp
            else:
                previous_beacon = None
            if len(raw) > snaplen:
                flags.append("snaplen")
            for flag in flags:
                anomalies[flag].append([timestamp, e["releaseOrdinal"], ordinal, offset, len(raw), wirelen, e["rate"], e["type"]])
            members = sorted({e[key] for key in ("transmitter", "receiver", "sourceAddress", "destinationAddress") if e[key] in eligible_clients})
            if parsed["type"] != "Beacon":
                for client in members:
                    clients[client].append(e)
                if members:
                    frame_lookup[frame_id] = members[0]
                if e["type"] in ("Deauthentication", "Disassociation") and e["reasonCode"] in (2, 23):
                    pattern_events.append({**{key:e[key] for key in ("id", "timeUs", "releaseOrdinal", "source", "reasonCode", "type", "transmitter", "receiver", "bssid")}, "client": members[0] if members else None})
                if e["security"].get("label"):
                    security_counts[e["security"]["label"]] += 1
            # Quality examples are published separately from client histories.
            if flags and any(len(anomalies[flag]) <= 3 for flag in flags):
                publish(OUT / "frames" / f"{frame_id}.json", e)
        for key, occurrences in anomalies.items():
            title, detail, restrictions = quality_specs[key]
            # Exact per-record timestamps permit prefix-correct quality counts.
            quality.append({"id": f"Q-{source['id']}-{key}", "source": source["id"], "kind": key,
                            "title": title, "detail": detail, "prohibitedMetrics": restrictions,
                            "ruleVersion": "capture-quality-3.0", "occurrences": occurrences,
                            "examples": [f"{source['id']}-{o[2]}" for o in occurrences[:3]], "declaredSnaplen": snaplen})
        print(source["id"], "quality", {k:len(v) for k,v in anomalies.items()}, flush=True)
    client_manifest, roaming_context = [], []
    for client, rows in sorted(clients.items()):
        rows.sort(key=lambda e:(e["timeUs"],e["releaseOrdinal"]))
        digest = publish(OUT / "clients" / f"{client}.json", {"client":client, "events":rows})
        client_manifest.append({"client":client,"path":f"clients/{client}.json","sha256":digest,"count":len(rows),"firstUs":rows[0]["timeUs"],"lastUs":rows[-1]["timeUs"]})
        signals = [[e["timeUs"],e["releaseOrdinal"],e["source"],e["signal"],e["id"]] for e in rows if e["transmitter"]==client and e["signal"] is not None]
        associations = [[e["timeUs"],e["releaseOrdinal"],e["source"],e["bssid"],e["id"]] for e in rows if e["receiver"]==client and e["type"] in ("Association response","Reassociation response") and e["statusCode"]==0]
        if signals and associations:
            roaming_context.append({"client":client,"signals":signals,"associations":associations})
    for old in (OUT / "clients").glob("*.json"):
        if old.stem not in clients:
            old.unlink() # Only obsolete generated diagnostic partitions, never inputs.
    # Small prefix checkpoints let historical summaries avoid loading records.
    # Full membership is paginated through bounded, lazy metadata chunks.
    for finding in quality:
        occurrences = finding.pop("occurrences")
        finding["count"] = len(occurrences)
        finding["firstOccurrence"] = occurrences[0][:2]
        finding["exampleOccurrences"] = [o[:2] for o in occurrences[:3]]
        finding["partitions"] = []
        for start in range(0,len(occurrences),2048):
            part = occurrences[start:start+2048]
            relative = f"quality/{finding['id']}-{start//2048}.json"
            # Lossless wire encoding only: all four integer provenance columns
            # are offsets from this partition's first member, and frame type is
            # a local dictionary index. Projection semantics remain unchanged.
            bases = part[0][:4]
            type_names = sorted({row[7] for row in part})
            packed = [[row[i]-bases[i] for i in range(4)]+row[4:7]+[type_names.index(row[7])] for row in part]
            digest = publish(OUT / relative, {"findingId":finding["id"],"encoding":"quality-delta-1","bases":bases,"types":type_names,"rows":packed})
            finding["partitions"].append({"path":relative,"sha256":digest,"count":len(part),"first":part[0][:2],"last":part[-1][:2]})
    inventory_rows = [{**item, "sources":sorted(item["sources"])} for item in inventory.values()]
    quality_hash = publish(OUT / "quality.json", {"findings":quality})
    index = {"schemaVersion":"3.0", "datasetId":base["manifest"]["datasetId"], "parserVersion":"airframe-security-3.0", "detectorVersion":"diagnostic-3.0", "aliasVersion":"2.0", "firstUs":base["manifest"]["firstUs"],"lastUs":base["manifest"]["lastUs"],
             "clients":client_manifest,"patternEvents":sorted(pattern_events,key=lambda e:e["releaseOrdinal"]),"inventory":inventory_rows,"roamingContext":roaming_context,
             "frameLookup":frame_lookup,"qualityPath":"quality.json", "qualitySha256":quality_hash, "securityCountsAudit":dict(security_counts),
             "limitations":["Recorded time has validity anomalies; no physical timing inference.","Capture coverage is asymmetric; missing frames do not prove failed exchanges.","No connected controller, AAA, supplicant or application evidence.","Observed BSSIDs are not an authoritative physical AP inventory."],
             "capabilities":{"eapMetadata":True,"fullClientHistory":True,"capturePatterns":True,"applicationRecovery":False,"stickyClientDiagnosis":False}}
    index["frameHashes"] = {p.stem:hashlib.sha256(p.read_bytes()).hexdigest() for p in (OUT / "frames").glob("*.json")}
    index_hash = publish(OUT / "index.json", index)
    base["manifest"]["diagnostics"] = {"schemaVersion":"3.0","indexSha256":index_hash,"path":"data-v3/index.json"}
    base["manifest"]["capabilities"]["eapMetadata"] = True
    base["manifest"]["capabilities"]["eapAnalysis"] = True
    base["manifest"]["limitations"] = [s for s in base["manifest"]["limitations"] if "EAP/802.1X" not in s]
    safe_eap_limit = "EAP/EAPOL metadata only; identities, method bodies and application payload are not published. Advanced PHY analysis is unsupported."
    if safe_eap_limit not in base["manifest"]["limitations"]:
        base["manifest"]["limitations"].append(safe_eap_limit)
    bundle_hash = publish(ROOT / "dist/data-v2/bundle.json", base)
    publish(ROOT / "dist/data-v2/manifest.json", base["manifest"])
    partition_path = ROOT / "dist/data-v2/partition-manifest.json"
    partitions = json.loads(partition_path.read_text())
    partitions["partitions"][0].update(sha256=bundle_hash,byteLength=(ROOT / "dist/data-v2/bundle.json").stat().st_size)
    publish(partition_path, partitions)
    publish(OUT / "audit.json", {"clientCount":len(clients),"clientObservations":sum(len(v) for v in clients.values()),"patternReasons":dict(Counter(e["reasonCode"] for e in pattern_events)),"securityMetadata":dict(security_counts),"inventoryBssids":len(inventory_rows),"qualityCounts":{f["id"]:f["count"] for f in quality}})
    print("Published",len(clients),"client histories; security",dict(security_counts),flush=True)

if __name__ == "__main__":
    main()
