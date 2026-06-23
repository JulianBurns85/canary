# Rayhunter Threat Analyzer v1.1

Automated forensic analysis tool for [Rayhunter](https://github.com/EFForg/rayhunter) cellular capture data. Detects IMSI catchers, rogue eNodeBs, null-cipher attacks, and related cellular surveillance techniques.

Built during a real 52-day investigation of suspected IMSI catcher activity in Cranbourne East, Victoria, Australia. The investigation confirmed 55,232 null-cipher violations across two independent mobile networks (Telstra AU and Vodafone AU), using this tool.

## What It Detects

| Technique | 3GPP Reference | Severity |
|---|---|---|
| IMSI Harvesting — Identity Request Flood | TS 24.301 §5.4.4 | CRITICAL |
| Null-Cipher Attack (EEA0+EIA0) | TS 33.401 §5.1.3.2 | CRITICAL |
| Forced 2G Downgrade (GERAN Redirect) | TS 36.331 §5.3.12 | CRITICAL |
| Auth Reject → Identity Request Chain | TS 24.301 §5.4.3.2 | HIGH |
| Unauthenticated Security Mode Command | TS 33.401 §8.2 | HIGH |
| Automated Paging Cycle (srsRAN signature) | TS 36.304 §7.1 | HIGH |
| Multi-EARFCN Anomaly | TS 36.101 | MEDIUM |
| ProSe/D2D Proximity Tracking | TS 33.303 | MEDIUM |

## Hardware Fingerprinting

The tool identifies likely attacker hardware based on signal patterns:
- Harris StingRay / HailStorm
- Septier IMSI Catcher / GUARDIAN
- Cobham Sentry
- **srsRAN / OpenAirInterface on SDR** — with specific fingerprints for the 210.2s paging cycle, multi-EARFCN operation, and EEA0+EIA0 default configuration
- Generic rogue eNodeB

## Supported File Types

- `.ndjson` — Rayhunter v0.10.x output (primary format)
- `.pcap` / `.pcapng` — GSMTAP captures (from QMDL conversion via SCAT)
- `.qmdl` / `.bin` — Raw Qualcomm DIAG binary (partial decode; SCAT recommended)

## Installation

```bash
pip install pyshark python-dateutil pyyaml requests scapy
# Optional for full QMDL decode:
pip install pySCAT
```

Requires Python 3.9+. On Windows with Python 3.10+, the tool automatically applies the `WindowsSelectorEventLoopPolicy` fix for pyshark.

## Usage

```bash
# Standard analysis
python main.py --dir /path/to/rayhunter/output --output report.json

# Full forensic run — all features
python main.py --dir /path/to/captures \
    --manifest \       # SHA-256 file manifest for chain of custody
    --timeline \       # Cross-file attack correlation
    --html \           # Interactive HTML timeline report
    --export-pcap \    # Clean exhibit PCAP of flagged events only
    --output report.json

# Network-isolated runs
python main.py --dir /captures/telstra --mnc 001 --output telstra.json
python main.py --dir /captures/vodafone --mnc 003 --output vodafone.json

# Compare two reports (track changes over time)
python main.py --compare report_old.json report_new.json

# Watch mode — real-time monitoring
python main.py --dir /path/to/rayhunter/output --watch --watch-interval 30
```

## Output Formats

| Output | Flag | Description |
|---|---|---|
| Terminal report | default | Colour-coded findings summary |
| JSON report | `--output file.json` | Machine-readable full report |
| HTML report | `--html` | Interactive timeline, filterable findings |
| SHA-256 manifest | `--manifest` | JSON + CSV file hashes for legal admissibility |
| Exhibit PCAP | `--export-pcap` | Flagged events only, Wireshark-compatible |
| Report diff | `--compare` | What changed between two runs |

## EARFCN Frequency Lookup

The tool automatically converts EARFCN numbers to real frequencies and cross-references against ACMA licensed spectrum bands in Australia. Example:

```
EARFCN 1275 = 1812.5 MHz DL (Band 3) — Licensed — Telstra/Vodafone/Optus 1800 MHz
EARFCN 3148 = 2659.8 MHz DL (Band 7) — Not in primary AU licensed table
EARFCN 9410 = 778.0 MHz DL (Band 28) — Licensed — Telstra/Vodafone/Optus 700 MHz APT
```

## Configuration

Edit `config.yaml` to set your MCC/MNC, known Cell IDs, OpenCelliD API key, and legal references. The config comes pre-populated with Australian network codes.

## OpenCelliD Integration

Register for a free API key at [opencellid.org](https://opencellid.org/register) and add it to `config.yaml`. The rogue tower detector will cross-reference captured Cell IDs against the OpenCelliD database — unlisted cells in a licensed band are flagged as potentially rogue.

## Legal Context

This tool was built for defensive security research under Australian law. Rayhunter operates passively — it captures only signals broadcast to your own registered SIM. No active network interference is performed.

Relevant Australian law:
- Radiocommunications Act 1992 (Cth) s.189 — unlicensed transmitter operation
- Telecommunications (Interception and Access) Act 1979 (Cth)
- Privacy Act 1988 (Cth)

## Background

This tool was developed during an independent forensic investigation of suspected cellular surveillance at a residential address in Cranbourne East, Victoria, Australia. The investigation ran from February to April 2026 and produced:

- 1,713,678 cellular events analyzed across 560 capture files
- 55,232 confirmed null-cipher (EEA0+EIA0) violations across Telstra AU and Vodafone AU
- 390 IMSI Identity Requests in a 120-second window (195× normal maximum)
- Automated paging cycle confirmed at 210.2-second intervals (srsRAN default)
- Evidence submitted to Victoria Police (CIRS-20260331-141), ACMA, and TIO

The raw capture dataset was submitted to the Electronic Frontier Foundation for independent verification.

## Author

Julian Burns — IT/Cybersecurity student, Melbourne, Australia  
GitHub: [@Julian-Burns85](https://github.com/Julian-Burns85)

## License

MIT License — use freely for defensive security research.
