# Canary

**IMSI-catcher detection for GrapheneOS**

Canary continuously monitors your phone's LTE cell environment and alerts you to signs of an IMSI catcher — a cell-site simulator, sometimes called a "Stingray." It runs on Pixel devices under GrapheneOS and logs detections to a clear, reviewable history.

The project began after I observed anomalous cellular behaviour I wanted to be able to detect reliably, and it's open source so others can do the same.

> [!NOTE]
> Canary reports *indicators* consistent with cell-site simulators. It does not, on its own, confirm a specific device or attribute it to any party. Treat its output as a signal for further investigation, not as proof.

<!-- TODO: add a screenshot here once you've placed the mockup in docs/, e.g.: ![Canary monitoring screen](docs/screenshot-monitor.png) -->

---

## What it does

Canary watches the LTE cell environment and raises an alert when it sees behaviour consistent with a rogue base station.

**Tier 1 — CellInfo API (any Android)**
- Polls Android's CellInfo API every 30 seconds
- Checks observed cells against a local identifier database (CID, eNB, TAC)
- Flags operator spoofing, RSRP/RSRQ anomalies, and known-bad identifiers
- Works immediately on install, no configuration required

**Tier 2 — Shannon IMS logcat (Pixel / GrapheneOS)**
- Streams real-time baseband logs from the Samsung Shannon IMS firmware service
- Surfaces events at the firmware layer — before they reach the OS
- Looks for identity requests, cipher-negotiation anomalies, and authentication irregularities
- Requires a one-time ADB command (see setup below)

**Call overlay**
- When your phone rings, Canary checks the cell environment and shows a status indicator over the incoming-call screen
- Green = nothing unusual detected
- Amber = possible rogue tower, with the option to respond now or after the call

**Defender mode (experimental, optional)**
- On a high-confidence detection, Canary can POST to your own CASTNET Pi to trigger a response action
- Off by default; requires your own Pi infrastructure
- A note on honesty: reliable countermeasures against modern cell-site simulators are an open problem. Treat Defender mode as experimental — useful for logging and research, not a guaranteed defence.

---

## Requirements

- **Device:** Google Pixel (Samsung Shannon baseband required for Tier 2)
- **OS:** [GrapheneOS](https://grapheneos.org) recommended, or stock Android 10+
- **PC:** needed once, for the Tier 2 ADB grant
- **CASTNET Pi:** optional — a Raspberry Pi running `castnet_api.py`, for remote database sync and Defender mode

---

## Installation

Canary isn't on the Play Store. Install via ADB sideload.

**1. Download the APK** from the [Releases](https://github.com/JulianBurns85/canary/releases) page.

**2. Enable ADB on the Pixel:** Settings → About phone → tap Build number 7 times → Developer options → enable USB debugging.

**3. Connect via USB and install:**

```bash
adb install app-release.apk
```

Or over Wi-Fi if ADB-over-TCP is enabled:

```bash
adb connect <phone-ip>:5555
adb -s <phone-ip>:5555 install app-release.apk
```

**4. Open Canary.** The first-run wizard walks you through setup and Tier 2 activation.

---

## Tier 2 setup (Shannon baseband)

Tier 1 is active immediately. Tier 2 needs a one-time permission grant from a PC with the Pixel connected via USB:

```bash
adb shell pm grant com.atomictech.canary android.permission.READ_LOGS
```

Then in Canary: **Settings → Shannon baseband → Activate Tier 2**.

The grant survives reboots — you only run it once per install.

> [!NOTE]
> GrapheneOS restricts `READ_LOGS` more aggressively than stock Android. The ADB grant is the correct way to enable it. If you factory reset or reinstall Canary, re-run the command.

---

## CASTNET Pi setup (optional)

CASTNET is the companion detection network. A Pi running `castnet_api.py` provides remote database sync, the Defender-mode trigger endpoint, and detection event aggregation across nodes.

```bash
# on the Pi
git clone https://github.com/JulianBurns85/CASTNET
cd CASTNET
pip install flask
python3 castnet_api.py
```

In Canary: **Settings → CASTNET Pi connection → enter your Pi's IP → Test connection.**

Point Canary at your own Pi, for example `http://<your-pi-ip>:5000`. Use a LAN address at home, or a [Tailscale](https://tailscale.com) address for remote access.

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

## Detection architecture

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
            └── SHANNON_IDENTITY_REQUEST   — Identity request at firmware layer
```

Detections are scored for confidence (0–1). High-confidence events can trigger Defender mode when it's enabled.

---

## Rogue database

Canary checks observed cells against a local database of identifiers (CID / eNB / TAC). It ships with a small seed set flagged during field testing, and you can add or remove entries yourself — or sync from your own CASTNET instance.

<!-- Keep your own confirmed identifier set in a private config file, not in this public README. -->

---

## Related projects

- **[CASTNET](https://github.com/JulianBurns85/CASTNET)** — distributed IMSI-catcher detection network
- **[rayhunter-threat-analyzer](https://github.com/JulianBurns85/rayhunter-threat-analyzer)** — RF corpus analysis and forensic reporting

---

## Legal & ethics

Canary is passive monitoring software. It does not transmit, jam, or interfere with any cellular network. All detection and logging happens on your own device and your own CASTNET infrastructure.

Use it only on devices and networks you're authorised to monitor, and in line with your local law.

---

## License

<!-- TODO: add a license. MIT is the simplest and most permissive; GPL-3.0 keeps derivative works open. -->

---

## Author

**Julian Burns** — Atomic Tech · [@Julian_Burns85](https://x.com/Julian_Burns85)

---

*Canary v3.0.0 · Atomic Tech · 2026*
