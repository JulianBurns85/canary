# Changelog

All notable changes to Canary are documented here.

---

## [3.0.0] — 2026-06-24

### Initial public release

**Core detection**
- Tier 1: Android CellInfo API polling every 30 seconds — works on any Android device, instant on install
- Tier 2: Samsung Shannon IMS baseband logcat stream — real-time firmware-layer detection on Pixel/GrapheneOS
- 10-detector framework: `ROGUE_CID_CONFIRMED`, `ROGUE_ENB_CONFIRMED`, `ROGUE_TAC_CONFIRMED`, `OPERATOR_SPOOF`, `RSRP_ANOMALY`, `RSRQ_ANOMALY`, `SHANNON_ROGUE_CID`, `SHANNON_ROGUE_ENB`, `SHANNON_IMS_SUPPORT_SERVICE`, `SHANNON_IDENTITY_REQUEST`
- Confidence scoring (0–1); events above 0.80 trigger Defender Mode

**Defender Mode**
- On confirmed threat, POSTs to CASTNET Pi (`/api/defender/trigger`)
- Pi executes `cm_harris.sh` — drops and restores mobile data via ADB to force bearer reset
- Call-aware queue: during active calls, defender fires automatically after hang-up
- 5-minute global cooldown between countermeasures (prevents per-CID alternation bug)
- Authenticated endpoint: `X-Canary-Secret` header required

**Call Overlay**
- Threat indicator over incoming call screen
- Green = safe to answer; Red = rogue tower active
- Options: defend immediately or defend after call ends

**CASTNET integration**
- Remote rogue database sync every 6 hours from CASTNET Pi
- Detection events reported to Pi for distributed corpus aggregation
- Configurable Pi URL with LAN/Tailscale fallback
- Auto Pi status check on Settings screen open
- ADB connection status indicator (Pi → Pixel keepalive health)

**Onboarding**
- 4-step first-run wizard: Welcome → Pi Setup → ADB/Tier 2 → Ready
- Pi URL entry and connection test during onboarding
- ADB command copy for Tier 2 activation
- One-time only — dismissed permanently via AsyncStorage

**History**
- Detection history with plain English detector labels
- Export button — shares full detection log as formatted text
- Pull-to-refresh

**Security**
- Signed release APK (V2 signer, CN=Julian Burns, O=Atomic Tech)
- CASTNET API authentication via shared secret
- Git history clean — no credentials in any commit
- `release.keystore` and `gradle.properties` excluded from version control

**Confirmed rogue database (Operation Hidden Blade)**
- Device A: Harris HailStorm II — eNB 537942, TAC 12385, Telstra mask
- Device B: srsRAN/BladeRF 2.0 — eNB 32849, TAC 30336, Vodafone mask
- YAICD 5.00/5.00 across 382,723+ events
- 4 triple-confirmed rogue CIDs (RF + Shannon IMS + CASTNET)

**Active regulatory references**
- AFP: 333080, 333545, 334105, 334860
- VicPol: INT26IR3127399
- ACMA: ENQ-1851DVJH04
- TIO: 2026-03-04898

---

## Version history

| Version | Date | Notes |
|---------|------|-------|
| 3.0.0 | 2026-06-24 | Initial public release |

---

*Canary is developed by Julian Burns, Atomic Tech, Cranbourne East VIC.*  
*Source: https://github.com/JulianBurns85/canary*
