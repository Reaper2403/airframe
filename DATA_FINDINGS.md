# AIRFRAME capture findings

## Capture inventory

Eight classic PCAP files were supplied (`sensor01.pcap` through `sensor08.pcap`), totaling 286,282,363 bytes and 1,118,853 captured frames. Every capture uses an 802.11 radiotap link type and spans approximately 30 minutes on 2026-09-16. The time ranges overlap almost completely.

Each file is fixed to a different 5 GHz frequency: 5180, 5200, 5220, 5240, 5745, 5765, 5785, and 5805 MHz. For that reason, AIRFRAME treats the filenames as synchronized capture sources, not as proven physical sensor locations. A source is effectively a channel viewpoint. The data does not contain location metadata.

## Available headers

The captures expose packet timestamp, capture source, receiver/transmitter/BSSID addresses, frame type and subtype, sequence and fragment numbers, retry and protected flags, duration, channel frequency, radiotap signal and noise, data rate, authentication/association status codes, and deauthentication/disassociation reason codes. QoS and action frames are present. EAPOL is not used by the prototype because the analysis is deliberately header-only.

## What is present

- 914,057 beacons and 173,964 probe responses dominate the dataset.
- 6,024 probe requests, 1,669 deauthentication frames, 817 authentication frames, 818 association request/response frames, and 330 disassociation frames are visible.
- All 1,503 decoded authentication/association status values are success (`0`); there is no supported failed-authentication incident.
- Deauthentication reasons include 23 (506 observations), 2 (1,477 observations), and 3 (16 observations).
- 54,544 frames carry the 802.11 retry flag across the eight capture sources.
- Radiotap signal, noise, frequency, and rate are present, so per-observation RF context is supportable.

## Strongest supported incident pattern

The most useful recurring sequence is an AP-originated deauthentication with reason 23, followed by active probing across several channel-specific capture sources and then successful authentication plus association to the same AP roughly 13 seconds later. The default demo incident involves client `3c:58:c2:00:00:04` and AP/BSSID `00:0b:86:04:00:00`: a reason-23 deauthentication, probe activity across all eight capture sources, 46 retry-marked probe responses, then successful authentication and association 13.127 seconds later.

This supports the observation **“disconnect followed by multi-channel recovery.”** It does not support a claim about why the AP initiated the disconnect. AIRFRAME recommends checking controller logs for that cause.

Other reliable detector outputs include retry bursts, deauthentication/disassociation sequences, repeated active probing, and successful reconnect sequences.

## Multi-source correlation limits

No same-frame duplicate groups were found with a strict fingerprint and an 8 ms time tolerance. That is consistent with each source monitoring a different channel. AIRFRAME therefore correlates a client’s ordered behavior across channel viewpoints instead of pretending that multiple sensors observed the same physical transmission. Timestamp offsets between capture starts are under approximately 2.3 seconds, but no clock-synchronization metadata is present.

## Unsupported analyses

The captures do not support physical location or floor maps, wired-side/controller causality, application performance, IP-layer diagnosis, payload inspection, or a definitive RF root cause. No authentication/association failures are visible. AP display names and device identities are absent, so the product uses MAC/BSSID identifiers. Inferences about interference, contention, roaming intent, or coverage are labeled as hypotheses rather than facts.
