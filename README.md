# CANARY v3.0

**IMSI catcher detection for GrapheneOS**

Real-time LTE rogue base station detection with autonomous countermeasure capability. Built for Pixel devices running GrapheneOS. Developed as part of Operation Hidden Blade — an 18-month investigation into confirmed rogue LTE infrastructure in Cranbourne East, Victoria, Australia.

---

## What it does

Canary continuously monitors the LTE cell environment and alerts you when a rogue base station (IMSI catcher / Stingray) is detected.

**Tier 1 — CellInfo API (any Android)**
- Polls Android's CellInfo API every 30 seconds
- Checks observed cells against a local rogue database (CID, eNB, TAC)
- Detects operator spoofing, RSRP/RSRQ anomalies, and confirmed rogue identifiers
- Works immediately on install, no configuration required

**Tier 2 — Shannon IMS Logcat (Pixel/GrapheneOS)**
- Streams real-time baseband logs from the Samsung Shannon IMS firmware service
- Detects attacks at the firmware layer — before they reach the OS
- Catches identity harvesting, cipher negotiation anomalies, and authentication attacks
- Requires a one-time ADB command (see setup below)

**Defender Mode**
- On confirmed threat (≥80% confidence), POSTs to your CASTNET Pi
- Pi runs `cm_harris.sh` via ADB — triggers a data cycle to force bearer reset
- During phone calls, defender fires automatically after you hang up
- 5-minute global cooldown between countermeasures

**Call Overlay**
- When your phone rings, Canary scans the cell environment and displays a threat indicator over the incoming call screen
- Green = safe to answer
- Red = rogue tower active, with options to defend immediately or after the call

---

## Requirements

- **Device:** Google Pixel (any generation with Samsung Shannon baseband for Tier 2)
- **OS:** [GrapheneOS](https://grapheneos.org) (recommended) or stock Android 10+
- **CASTNET Pi:** Raspberry Pi running `castnet_api.py` (for Defender Mode and remote rogue DB — optional but recommended)
- **PC:** Required once for Tier 2 ADB setup

---

## Installation

Canary is not on the Play Store. Install via ADB sideload.

**1. Download the APK**

Download `app-release.apk` from the [Releases](https://github.com/JulianBurns85/canary/releases) page.

**2. Enable ADB on the Pixel**

On your Pixel: Settings → About Phone → tap Build Number 7 times → Developer Options → enable USB Debugging.

**3. Connect via USB and install**

```bash
adb install app-release.apk
```

Or wirelessly if ADB over TCP is already enabled:

```bash
adb connect 192.168.x.x:5555
adb -s 192.168.x.x:5555 install app-release.apk
```

**4. Open Canary**

The first-run onboarding wizard will guide you through Pi setup and Tier 2 activation.

---

## Tier 2 Setup (Shannon baseband)

Tier 1 is active immediately. Tier 2 requires a one-time permission grant from a PC with the Pixel connected via USB:

```bash
adb shell pm grant com.atomictech.canary android.permission.READ_LOGS
```

Then in Canary: **Settings → Shannon Baseband → Activate Tier 2**

The permission survives reboots. You only need to run this once per install.

> **GrapheneOS note:** GrapheneOS restricts `READ_LOGS` more aggressively than stock Android. The ADB grant method bypasses this restriction correctly. If you factory reset or reinstall Canary, you will need to re-run the ADB command.

---

## CASTNET Pi Setup (optional)

CASTNET is the companion distributed detection network. A Pi running `castnet_api.py` provides:

- Remote rogue database (synced from the CASTNET corpus)
- Defender Mode trigger endpoint (`/api/defender/trigger`)
- Detection event aggregation across nodes

**Quick setup:**

```bash
# On the Pi
git clone https://github.com/JulianBurns85/CASTNET
cd CASTNET
pip install flask
python3 castnet_api.py
```

In Canary: **Settings → CASTNET Pi Connection → enter your Pi's IP → Test Connection**

Default endpoints (tried automatically if no custom URL is set):
- `http://100.68.146.48:5000` — Tailscale (remote access)
- `http://192.168.1.239:5000` — LAN fallback

---

## Permissions

| Permission | Purpose |
|------------|---------|
| `ACCESS_FINE_LOCATION` | Required by Android to read cell tower information |
| `ACCESS_COARSE_LOCATION` | Required by Android to read cell tower information |
| `READ_PHONE_STATE` | Read CellInfo API data |
| `READ_LOGS` | Tier 2 Shannon baseband stream (ADB grant required) |
| `FOREGROUND_SERVICE` | Background scanning |
| `RECEIVE_BOOT_COMPLETED` | Restart scanning after reboot |
| `INTERNET` | Pi API communication |
| `SYSTEM_ALERT_WINDOW` | Call overlay display |

---

## Detection Architecture

```
CellInfo API (30s poll)
    └── detectionEngine.ts
            ├── ROGUE_CID_CONFIRMED    — CID in known rogue database
            ├── ROGUE_ENB_CONFIRMED    — eNB in known rogue database
            ├── ROGUE_TAC_CONFIRMED    — TAC in known rogue database
            ├── OPERATOR_SPOOF        — MCC/MNC mismatch for observed eNB
            ├── RSRP_ANOMALY          — Signal strength outside normal range
            └── RSRQ_ANOMALY          — Signal quality outside normal range

Shannon IMS Logcat (real-time)
    └── shannonParser.ts
            ├── SHANNON_ROGUE_CID          — Rogue CID in firmware logs
            ├── SHANNON_ROGUE_ENB          — Rogue eNB in firmware logs
            ├── SHANNON_IMS_SUPPORT_SERVICE — Anomalous IMS service activity
            └── SHANNON_IDENTITY_REQUEST   — Identity harvest attempt at firmware layer
```

Detections are scored for confidence (0–1). Events above 0.80 trigger Defender Mode when enabled.

---

## Confirmed Rogue Platforms (Operation Hidden Blade)

The local rogue database ships with the following confirmed devices:

| Device | Platform | eNB | TAC | Operator Mask |
|--------|----------|-----|-----|---------------|
| Device A | Harris HailStorm II | 537942 | 12385 | Telstra (MCC=505 MNC=01) |
| Device B | srsRAN/BladeRF 2.0 | 32849 | 30336 | Vodafone (MCC=505 MNC=03) |

YAICD score: **5.00/5.00 (CRITICAL)** across 382,723+ events.

Active regulatory references: AFP 333080, 333545, 334105, 334860 · VicPol INT26IR3127399 · ACMA ENQ-1851DVJH04 · TIO 2026-03-04898

---

## Related Projects

- **[CASTNET](https://github.com/JulianBurns85/CASTNET)** — Distributed IMSI catcher detection network
- **[rayhunter-threat-analyzer](https://github.com/JulianBurns85/rayhunter-threat-analyzer)** — RF corpus analysis and forensic reporting (v4.3+)

---

## Legal

Canary is passive monitoring software. It does not transmit, jam, or interfere with any cellular network. Detection and countermeasure logging is performed solely on the user's own device and their own CASTNET infrastructure.

Operation against rogue LTE infrastructure is conducted under passive observation only. All formal evidence submissions are filed with the Australian Federal Police, ACMA, VicPol, and TIO.

---

## Author

**Julian Burns** — Director, Atomic Tech  
Cranbourne East, Victoria, Australia  
[@Julian_Burns85](https://x.com/Julian_Burns85)  

---

*Canary v3.0.0 · Atomic Tech · 2026*
