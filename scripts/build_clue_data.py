"""Build a small, whitelisted projection of verified published client histories.

The source captures and existing publications are read-only. No packet bytes,
MAC addresses, EAP identities, SSIDs, or free text are copied into this format.
An original frame occurs once even if multiple client histories contain it.
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
SOURCE = DIST / "data-v3"
OUT = DIST / "data-v4"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def verified(path, expected):
    data = path.read_bytes()
    if digest(data) != expected:
        raise ValueError(f"Published source hash mismatch: {path.name}")
    return json.loads(data)


def write_json(path, value):
    data = json.dumps(value, separators=(",", ":"), sort_keys=True).encode()
    path.write_bytes(data)
    return digest(data)


def main():
    manifest = json.loads((DIST / "data-v2/manifest.json").read_bytes())
    index = verified(SOURCE / "index.json", manifest["diagnostics"]["indexSha256"])
    if index["datasetId"] != manifest["datasetId"]:
        raise ValueError("Dataset identity mismatch")
    sources = {s["id"]: s for s in manifest["sources"]}
    events = {}
    clients = sorted(c["client"] for c in index["clients"])
    histories = {}
    for entry in index["clients"]:
        data = verified(SOURCE / entry["path"], entry["sha256"])
        if data["client"] != entry["client"]:
            raise ValueError("Client membership mismatch")
        histories[entry["client"]] = {k: entry[k] for k in ("path", "sha256")}
        for event in data["events"]:
            if event["captureHash"] != sources[event["source"]]["sha256"]:
                raise ValueError("Capture identity mismatch")
            existing = events.setdefault(event["id"], {"event": event, "clients": set()})
            if existing["event"] != event:
                raise ValueError("Conflicting canonical observation")
            existing["clients"].add(entry["client"])
    source_ids = sorted(sources)
    aps = sorted({x["event"]["bssid"] for x in events.values() if (x["event"].get("bssid") or "").startswith("AP-")})
    types = sorted({x["event"]["type"] for x in events.values()})
    # Security dictionary is structured metadata only, never arbitrary EAP text.
    def security(e):
        s = e.get("security", {})
        return (s.get("protocol") if s.get("protocol") in ("EAP", "EAPOL-Key") else None,
                s.get("code"), s.get("eapType"), s.get("keyStage") if s.get("keyStage") in ("M1", "M2", "M3", "M4") else None,
                s.get("identifier") if isinstance(s.get("identifier"), int) and 0 <= s["identifier"] <= 255 else None,
                s.get("replayCounter") if isinstance(s.get("replayCounter"), str) and s["replayCounter"].isdigit() else None)
    security_values = sorted({security(x["event"]) for x in events.values()}, key=str)
    source_map = {v: i for i, v in enumerate(source_ids)}
    client_map = {v: i for i, v in enumerate(clients)}
    ap_map = {v: i for i, v in enumerate(aps)}
    type_map = {v: i for i, v in enumerate(types)}
    security_map = {v: i for i, v in enumerate(security_values)}
    rows = []
    for item in sorted(events.values(), key=lambda x: (x["event"]["timeUs"], x["event"]["releaseOrdinal"])):
        e = item["event"]
        members = sorted(client_map[c] for c in item["clients"])
        # Flags: retry, protected data, eligible retry, successful open auth,
        # client transmitted, client received. Last two refer to membership.
        flags = (int(e.get("retry") is True) + 2 * int(e.get("protected") is True and e.get("frameType") == 2)
                 + 4 * int(e.get("frameType") in (0, 2) and isinstance(e.get("retry"), bool))
                 + 8 * int(e.get("type") == "Authentication" and e.get("authAlgorithm") == 0 and e.get("statusCode") == 0)
                 + 16 * int(e.get("transmitter") in item["clients"]) + 32 * int(e.get("receiver") in item["clients"]))
        rows.append([e["timeUs"] - manifest["firstUs"], e["releaseOrdinal"], source_map[e["source"]],
                     e["frameNumber"], members[0] if len(members) == 1 else members,
                     ap_map.get(e.get("bssid"), -1), type_map[e["type"]], flags,
                     e.get("reasonCode"), e.get("statusCode"), security_map[security(e)], e.get("sequence")])
    OUT.mkdir(exist_ok=True)
    data = {"encoding": "clue-tuples-2", "datasetId": manifest["datasetId"], "firstUs": manifest["firstUs"],
            "columns": ["timeDeltaUs", "releaseOrdinal", "sourceIndex", "frameNumber", "clientMembershipIndex", "apIndex", "typeIndex", "flags", "reasonCode", "statusCode", "securityIndex", "sequence"],
            "sources": source_ids, "clients": clients, "aps": aps, "types": types,
            "security": security_values, "rows": rows}
    events_hash = write_json(OUT / "observations.json", data)
    projection = {"schemaVersion": "airframe-clues-data-1.0", "datasetId": manifest["datasetId"],
                  "aliasVersion": manifest["aliasVersion"], "firstUs": manifest["firstUs"], "lastUs": manifest["lastUs"],
                  "sourceIndexSha256": manifest["diagnostics"]["indexSha256"], "path": "observations.json", "sha256": events_hash,
                  "eventCount": len(rows), "histories": histories,
                  "scope": "Deduplicated original observations from published client histories; excludes beacon-only and other unpublished frame populations.",
                  "advertisedProfileCoverage": {"state": "unavailable", "fields": {"ssidAlias": False, "advertisedAkm": False}, "reason": "Verified source index and published client histories contain neither SSID aliases nor advertised AKM. Observed EAP/key traffic must not be relabelled as a configured security profile."},
                  "sourceSources": [{"id": s["id"], "sha256": s["sha256"], "channel": s["channel"], "frequency": s["frequency"]} for s in manifest["sources"]]}
    index_hash = write_json(OUT / "index.json", projection)
    (DIST / "js/clue-integrity.js").write_text("// Generated by scripts/build_clue_data.py; do not edit manually.\nexport const CLUE_INTEGRITY = " + json.dumps({"datasetId": manifest["datasetId"], "indexSha256": index_hash}, separators=(",", ":")) + ";\n")
    print(json.dumps({"observations": len(rows), "bytes": (OUT / "observations.json").stat().st_size, "indexSha256": index_hash}))


if __name__ == "__main__":
    main()
