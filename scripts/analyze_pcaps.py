#!/usr/bin/env python3
"""Header-only 802.11 inventory and incident extraction for the AIRFRAME demo."""
from __future__ import annotations

import json
import struct
from collections import Counter, defaultdict, deque
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
OUT = ROOT / "public" / "data"
OUT.mkdir(parents=True, exist_ok=True)

SUBTYPES = {
    (0, 0): "association request", (0, 1): "association response",
    (0, 2): "reassociation request", (0, 3): "reassociation response",
    (0, 4): "probe request", (0, 5): "probe response",
    (0, 8): "beacon", (0, 10): "disassociation",
    (0, 11): "authentication", (0, 12): "deauthentication",
    (0, 13): "action", (1, 11): "RTS", (1, 12): "CTS",
    (1, 13): "ACK", (2, 0): "data", (2, 4): "null data",
    (2, 8): "QoS data", (2, 12): "QoS null",
}

RT_FIELDS = {
    0: (8, 8), 1: (1, 1), 2: (1, 1), 3: (2, 4), 4: (2, 2),
    5: (1, 1), 6: (1, 1), 7: (2, 2), 8: (2, 2), 9: (2, 2),
    10: (1, 1), 11: (1, 1), 12: (1, 1), 13: (1, 1), 14: (2, 2),
    15: (2, 2), 16: (1, 1), 17: (1, 1), 18: (4, 8), 19: (1, 3),
    20: (4, 8), 21: (2, 12), 22: (8, 12), 23: (2, 12), 24: (2, 12),
}


def mac(b: bytes) -> str | None:
    if len(b) != 6:
        return None
    return ":".join(f"{x:02x}" for x in b)


def parse_radiotap(raw: bytes):
    if len(raw) < 8:
        return None
    rtlen = struct.unpack_from("<H", raw, 2)[0]
    present = []
    pos = 4
    while pos + 4 <= len(raw):
        word = struct.unpack_from("<I", raw, pos)[0]
        present.append(word)
        pos += 4
        if not (word & 0x80000000):
            break
    cursor = pos
    values = {}
    for wi, word in enumerate(present):
        for bit in range(31):
            if not (word & (1 << bit)):
                continue
            idx = wi * 32 + bit
            if idx not in RT_FIELDS:
                continue
            align, size = RT_FIELDS[idx]
            cursor += (-cursor) % align
            if cursor + size > rtlen:
                break
            values[idx] = raw[cursor:cursor + size]
            cursor += size
    freq = struct.unpack_from("<H", values[3], 0)[0] if 3 in values else None
    signal = struct.unpack("b", values[5])[0] if 5 in values else None
    noise = struct.unpack("b", values[6])[0] if 6 in values else None
    rate = values[2][0] / 2 if 2 in values else None
    return rtlen, freq, signal, noise, rate


def iter_pcap(path: Path):
    with path.open("rb") as f:
        header = f.read(24)
        magic = header[:4]
        if magic == b"\xd4\xc3\xb2\xa1": endian, scale = "<", 1_000_000
        elif magic == b"\xa1\xb2\xc3\xd4": endian, scale = ">", 1_000_000
        elif magic == b"\x4d\x3c\xb2\xa1": endian, scale = "<", 1_000_000_000
        elif magic == b"\xa1\xb2\x3c\x4d": endian, scale = ">", 1_000_000_000
        else: raise ValueError(f"Unsupported capture format: {path}")
        linktype = struct.unpack_from(endian + "I", header, 20)[0]
        if linktype != 127: raise ValueError(f"Expected radiotap (127), got {linktype}")
        record = struct.Struct(endian + "IIII")
        while True:
            h = f.read(16)
            if not h: return
            sec, frac, caplen, _ = record.unpack(h)
            raw = f.read(caplen)
            yield sec + frac / scale, raw


@dataclass(slots=True)
class Event:
    id: str
    timestamp: float
    sensor: str
    frame_type: str
    transmitter: str | None
    receiver: str | None
    bssid: str | None
    sequence: int | None
    fragment: int | None
    retry: bool
    protected: bool
    signal: int | None
    noise: int | None
    frequency: int | None
    rate: float | None
    status_code: int | None = None
    reason_code: int | None = None


def parse_dot11(ts, raw, sensor, idx):
    rt = parse_radiotap(raw)
    if not rt: return None
    rtlen, freq, signal, noise, rate = rt
    d = raw[rtlen:]
    if len(d) < 10: return None
    fc, _duration = struct.unpack_from("<HH", d, 0)
    typ, subtype = (fc >> 2) & 3, (fc >> 4) & 15
    receiver = mac(d[4:10])
    transmitter = mac(d[10:16]) if len(d) >= 16 and typ != 1 else None
    bssid = mac(d[16:22]) if len(d) >= 22 and typ != 1 else None
    seq = frag = None
    if len(d) >= 24 and typ != 1:
        sc = struct.unpack_from("<H", d, 22)[0]
        seq, frag = sc >> 4, sc & 15
    retry = bool(fc & 0x0800)
    protected = bool(fc & 0x4000)
    status = reason = None
    body = d[24:] if len(d) >= 24 else b""
    if typ == 0 and subtype == 11 and len(body) >= 6:
        status = struct.unpack_from("<H", body, 4)[0]
    elif typ == 0 and subtype in (1, 3) and len(body) >= 4:
        status = struct.unpack_from("<H", body, 2)[0]
    elif typ == 0 and subtype in (10, 12) and len(body) >= 2:
        reason = struct.unpack_from("<H", body, 0)[0]
    return Event(
        f"{sensor}-{idx}", ts, sensor, SUBTYPES.get((typ, subtype), f"type {typ}/{subtype}"),
        transmitter, receiver, bssid, seq, frag, retry, protected,
        signal, noise, freq, rate, status, reason,
    ), typ, subtype


def iso(ts):
    return datetime.fromtimestamp(ts, timezone.utc).isoformat().replace("+00:00", "Z")


def main():
    captures = []
    frame_types = Counter()
    channels = Counter()
    aps = Counter()
    stations = Counter()
    status_codes = Counter()
    reasons = Counter()
    notable = []
    retry_by_tx = defaultdict(deque)
    retry_bursts = []
    correlation = defaultdict(list)
    sensor_rssi = defaultdict(lambda: defaultdict(list))
    sample_events = []
    total = 0

    for path in sorted(RAW.glob("*.pcap")):
        sensor = path.stem.replace("sensor", "S")
        first = last = None
        count = retry_count = 0
        capture_freqs = Counter()
        for idx, (ts, raw) in enumerate(iter_pcap(path), 1):
            parsed = parse_dot11(ts, raw, sensor, idx)
            if not parsed: continue
            ev, typ, subtype = parsed
            first = ts if first is None else first; last = ts
            count += 1; total += 1
            frame_types[ev.frame_type] += 1
            if ev.frequency:
                channels[ev.frequency] += 1
                capture_freqs[ev.frequency] += 1
            if ev.bssid and ev.bssid != "ff:ff:ff:ff:ff:ff": aps[ev.bssid] += 1
            if ev.transmitter and ev.transmitter != "ff:ff:ff:ff:ff:ff": stations[ev.transmitter] += 1
            if ev.status_code is not None: status_codes[ev.status_code] += 1
            if ev.reason_code is not None: reasons[ev.reason_code] += 1
            if ev.signal is not None and ev.transmitter:
                sensor_rssi[ev.transmitter][sensor].append(ev.signal)

            interesting = typ == 0 and subtype in (0,1,2,3,4,10,11,12,13)
            if ev.retry:
                retry_count += 1; interesting = True
                if ev.transmitter:
                    q = retry_by_tx[(sensor, ev.transmitter)]
                    q.append(ev)
                    while q and ts - q[0].timestamp > 2.0: q.popleft()
                    if len(q) >= 12 and (not retry_bursts or q[0].timestamp > retry_bursts[-1]["end"]):
                        retry_bursts.append({"sensor":sensor,"transmitter":ev.transmitter,"start":q[0].timestamp,"end":ts,"count":len(q),"events":list(q)[-12:]})
            if interesting:
                notable.append(ev)
                fp = (typ, subtype, ev.transmitter, ev.receiver, ev.bssid, ev.sequence, ev.fragment, ev.retry)
                correlation[fp].append(ev)
            if len(sample_events) < 60 and interesting: sample_events.append(ev)
        captures.append({"sensor": sensor, "file": path.name, "bytes": path.stat().st_size,
                         "frames": count, "retries": retry_count, "start": first, "end": last,
                         "frequency": capture_freqs.most_common(1)[0][0] if capture_freqs else None,
                         "duration_seconds": round((last-first) if first and last else 0, 3)})

    # Cross-sensor groups must be temporally close; split repeated sequence fingerprints into 8 ms clusters.
    groups = []
    for fp, events in correlation.items():
        if len({e.sensor for e in events}) < 2: continue
        events.sort(key=lambda e:e.timestamp)
        cluster=[]
        for ev in events:
            if cluster and ev.timestamp-cluster[-1].timestamp > .008:
                if len({x.sensor for x in cluster}) >= 2: groups.append(cluster)
                cluster=[]
            cluster.append(ev)
        if len({x.sensor for x in cluster}) >= 2: groups.append(cluster)
    groups.sort(key=lambda g:(-len({e.sensor for e in g}), g[0].timestamp))

    # Detect AP-initiated disconnect -> active multi-channel scan -> successful reconnect.
    # This is a recurring, header-visible pattern in these captures and is the strongest demo story.
    notable.sort(key=lambda e:e.timestamp)
    reconnects=[]
    for d in [e for e in notable if e.frame_type == "deauthentication" and e.reason_code == 23]:
        client, ap = d.receiver, d.transmitter
        if not client or not ap: continue
        window=[e for e in notable if d.timestamp-.8 <= e.timestamp <= d.timestamp+20 and client in (e.transmitter,e.receiver)]
        auth=next((e for e in window if e.timestamp>d.timestamp and e.frame_type=="authentication" and e.transmitter==ap and e.status_code==0),None)
        assoc=next((e for e in window if auth and e.timestamp>=auth.timestamp and e.frame_type in ("association response","reassociation response") and e.transmitter==ap and e.status_code==0),None)
        if not (auth and assoc): continue
        scans=[e for e in window if d.timestamp <= e.timestamp <= auth.timestamp and e.frame_type=="probe request" and e.transmitter==client]
        retry_responses=[e for e in window if d.timestamp <= e.timestamp <= auth.timestamp and e.frame_type=="probe response" and e.retry and e.receiver==client]
        sensors=sorted({e.sensor for e in scans+retry_responses+[d,auth,assoc]})
        if len(sensors)<3 or not scans: continue
        # Keep the causal milestones plus representative evidence from every capture source.
        evidence=[d]
        for s in sensors:
            evidence.extend([e for e in scans if e.sensor==s][:1])
            evidence.extend([e for e in retry_responses if e.sensor==s][:1])
        evidence += [auth,assoc]
        evidence=sorted({e.id:e for e in evidence}.values(), key=lambda e:e.timestamp)
        reconnects.append({"deauth":d,"client":client,"ap":ap,"auth":auth,"assoc":assoc,"scans":scans,
                           "retry_responses":retry_responses,"sensors":sensors,"evidence":evidence})

    # Rank real incident candidates: reconnect sequences first, then deauths and retry bursts.
    failed = [e for e in notable if e.status_code not in (None,0)]
    disruptive = [e for e in notable if e.frame_type in ("deauthentication","disassociation")]
    candidates=[]
    for e in failed[:20]:
        candidates.append((95, "Authentication / association rejected", e.timestamp, e.transmitter, e.bssid, [e]))
    for e in disruptive[:20]:
        candidates.append((88, e.frame_type.title()+" observed", e.timestamp, e.receiver, e.bssid, [e]))
    for b in sorted(retry_bursts,key=lambda x:-x["count"])[:30]:
        candidates.append((80+min(b["count"],20), "Retry burst", b["start"], b["transmitter"], None, b["events"]))
    candidates.sort(reverse=True, key=lambda x:x[0])

    incidents=[]
    seen=[]
    for r in reconnects:
        if any(r["client"]==x for x in seen): continue
        d,assoc=r["deauth"],r["assoc"]
        incidents.append({
            "id":f"AF-{104+len(incidents)}", "title":"Disconnect and multi-channel recovery",
            "timestamp":d.timestamp,"time":iso(d.timestamp),"client":r["client"],"ap":r["ap"],
            "sensors":r["sensors"],"duration_seconds":round(assoc.timestamp-d.timestamp,3),"confidence":92,
            "observation":f"AP {r['ap']} sent deauthentication reason 23. The client then scanned across {len(r['sensors'])} capture sources; {len(r['retry_responses'])} retry-marked probe responses preceded successful authentication and association {assoc.timestamp-d.timestamp:.1f} seconds later.",
            "interpretation":"This is a reconnect sequence following an AP-initiated disconnect. The headers establish ordering, but not why the AP disconnected the client.",
            "next_step":"Check the AP controller logs for the reason-23 disconnect, then compare RF conditions on the channels scanned before reconnection.",
            "evidence":[asdict(e)|{"time":iso(e.timestamp)} for e in r["evidence"]],
            "sequence":{
                "deauthentication":iso(d.timestamp),"scan_start":iso(min(e.timestamp for e in r["scans"])) if r["scans"] else None,
                "authentication":iso(r["auth"].timestamp),"association":iso(assoc.timestamp),
                "probe_requests":len(r["scans"]),"retry_probe_responses":len(r["retry_responses"]),
            }
        })
        seen.append(r["client"])
        if len(incidents)>=3: break

    for score,title,ts,client,ap,evs in candidates:
        if client in seen or any(isinstance(x,tuple) and abs(ts-x[0])<2 and client==x[1] for x in seen): continue
        nearby=[e for e in notable if abs(e.timestamp-ts)<=2.5 and (client in (e.transmitter,e.receiver) if client else True)]
        evidence=(nearby or evs)[:18]
        sensors=sorted({e.sensor for e in evidence})
        retries=sum(e.retry for e in evidence)
        observation = (f"{retries} retry-marked frames and {len(evidence)-retries} management events were captured within a 5-second evidence window."
                       if title=="Retry burst" else
                       f"A {evidence[0].frame_type} frame was captured with status {evidence[0].status_code} or reason {evidence[0].reason_code}.")
        interpretation = ("The burst is consistent with link contention, interference, or a weakening RF path; headers alone cannot distinguish the cause."
                          if title=="Retry burst" else
                          "The management exchange indicates a connectivity transition or rejection; surrounding frames should be checked before assigning cause.")
        incidents.append({
            "id":f"AF-{104+len(incidents)}", "title":title, "timestamp":ts, "time":iso(ts),
            "client":client, "ap":ap or next((e.bssid for e in evidence if e.bssid),None),
            "sensors":sensors, "duration_seconds":round(max(e.timestamp for e in evidence)-min(e.timestamp for e in evidence),3),
            "confidence":min(92,58+len(sensors)*7+min(len(evidence),12)), "observation":observation,
            "interpretation":interpretation, "next_step":"Compare the correlated observations and inspect channel conditions near this timestamp.",
            "evidence":[asdict(e) | {"time":iso(e.timestamp)} for e in evidence]
        })
        seen.append((ts,client))
        if len(incidents)>=4: break

    # If a candidate lacks cross-sensor evidence, enrich the lead demo with the closest correlated group.
    if incidents and groups:
        lead=incidents[0]; base=lead["timestamp"]
        close=min(groups,key=lambda g:abs(g[0].timestamp-base))
        lead["correlated_event"]={
            "frame_type":close[0].frame_type,"sequence":close[0].sequence,
            "timestamp":close[0].timestamp,"time":iso(close[0].timestamp),
            "observations":[asdict(e)|{"time":iso(e.timestamp)} for e in close[:8]]
        }

    def med(xs):
        if not xs:return None
        s=sorted(xs); return s[len(s)//2]
    top_aps=[{"bssid":k,"frames":v,"sensors":[s for s in sorted(sensor_rssi[k])],
              "median_signal_by_sensor":{s:med(vals) for s,vals in sensor_rssi[k].items()}} for k,v in aps.most_common(12)]
    top_clients=[]
    ap_set={x["bssid"] for x in top_aps}
    for k,v in stations.most_common():
        if k in ap_set or k.startswith("00:0b:86:"): continue
        top_clients.append({"mac":k,"frames":v,"sensors":sorted(sensor_rssi[k]),
                            "median_signal_by_sensor":{s:med(vals) for s,vals in sensor_rssi[k].items()}})
        if len(top_clients)>=16:break

    inventory={
        "generated_at":datetime.now(timezone.utc).isoformat(),"total_frames":total,"captures":captures,
        "frame_types":dict(frame_types.most_common()),"frequencies":dict(channels.most_common()),
        "status_codes":dict(status_codes),"reason_codes":dict(reasons),
        "top_access_points":top_aps,"top_clients":top_clients,
        "multi_sensor_correlated_groups":len(groups),
        "available_fields":["timestamp","sensor source","receiver/transmitter/BSSID","frame type/subtype","sequence/fragment","retry/protected flags","duration","frequency/channel","signal","noise","data rate","authentication/association status","deauthentication/disassociation reason"],
    }
    for name,obj in (("inventory",inventory),("incidents",incidents),("clients",top_clients),("access_points",top_aps)):
        (OUT/f"{name}.json").write_text(json.dumps(obj,indent=2))
    (OUT/"events.json").write_text(json.dumps([asdict(e)|{"time":iso(e.timestamp)} for e in notable[:1200]],indent=2))
    print(json.dumps({"total_frames":total,"captures":captures,"incidents":incidents,"groups":len(groups)},indent=2,default=str))

if __name__ == "__main__": main()
