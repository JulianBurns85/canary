/**
 * detectionEngine.ts — Canary v3 detection scoring engine
 *
 * Processes raw events from Tier 1 (CellInfo) and Tier 2 (Shannon logcat).
 * Produces a scored DetectionResult for every cell observation.
 *
 * Scoring philosophy: additive confidence, capped at 1.0.
 * A single confirmed rogue CID = immediate THREAT at 1.0.
 * Anomalies without CID confirmation accumulate toward thresholds.
 */

import {
  isCidRogue,
  isEnbRogue,
  isTacRogue,
  isOperatorSpoofed,
  enbFromCid,
  getDetectionThresholds,
} from './rogueDatabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThreatLevel = 'CLEAR' | 'SUSPICIOUS' | 'HIGH' | 'THREAT';

export interface RawCellInfo {
  type: 'LTE' | 'NR' | 'WCDMA' | 'GSM';
  cid: number;
  pci?: number;
  tac: number;
  mcc: string;
  mnc: string;
  earfcn?: number;
  rsrp?: number;       // dBm — reference signal received power
  rsrq?: number;       // dB  — reference signal received quality
  registered: boolean;
  timestamp: number;   // epoch ms
}

export interface ShannonEvent {
  raw_line: string;
  cid?: number;
  event_type?: string;
  timestamp: number;
  tier: 2;
}

export interface DetectionResult {
  id: string;                  // uuid-like for dedup
  timestamp: number;
  tier: 1 | 2;
  threat_level: ThreatLevel;
  confidence: number;          // 0.0 – 1.0
  detectors_fired: string[];
  cell_info?: RawCellInfo;
  shannon_event?: ShannonEvent;
  // Derived identifiers
  cid?: number;
  enb_id?: number;
  tac?: number;
  mcc?: string;
  mnc?: string;
  rsrp?: number;
  rsrq?: number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const simpleId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

const threatFromConfidence = (c: number): ThreatLevel => {
  const t = getDetectionThresholds();
  if (c >= t.confidence_threat) return 'THREAT';
  if (c >= t.confidence_high) return 'HIGH';
  if (c >= t.confidence_suspicious) return 'SUSPICIOUS';
  return 'CLEAR';
};

// ─── Tier 1: CellInfo scoring ─────────────────────────────────────────────────

export const scoreCellInfo = (cell: RawCellInfo): DetectionResult => {
  const detectors: string[] = [];
  let confidence = 0;
  const t = getDetectionThresholds();

  const enbId = enbFromCid(cell.cid);

  // ── Hard matches (immediate THREAT) ──────────────────────────────────────

  if (isCidRogue(cell.cid)) {
    confidence = 1.0;
    detectors.push('ROGUE_CID_CONFIRMED');
  }

  if (isEnbRogue(enbId)) {
    confidence = clamp(Math.max(confidence, 0.99), 0, 1);
    detectors.push('ROGUE_ENB_CONFIRMED');
  }

  if (isTacRogue(cell.tac)) {
    confidence = clamp(Math.max(confidence, 0.95), 0, 1);
    detectors.push('ROGUE_TAC_CONFIRMED');
  }

  if (isOperatorSpoofed(cell.mcc, cell.mnc, cell.tac)) {
    confidence = clamp(Math.max(confidence, 0.95), 0, 1);
    detectors.push('OPERATOR_SPOOF');
  }

  // ── Soft anomalies (accumulate confidence) ────────────────────────────────

  if (
    cell.rsrp !== undefined &&
    cell.rsrp > t.rsrp_anomaly_strong_dbm
  ) {
    // Suspiciously strong signal — rogue cells often boost power to force attach
    confidence = clamp(confidence + 0.2, 0, 1);
    detectors.push('RSRP_ANOMALY');
  }

  if (
    cell.rsrq !== undefined &&
    cell.rsrq > t.rsrq_anomaly_strong_db
  ) {
    confidence = clamp(confidence + 0.1, 0, 1);
    detectors.push('RSRQ_ANOMALY');
  }

  // Unregistered cell that matches rogue TAC — suspicious
  if (!cell.registered && isTacRogue(cell.tac) && confidence < 0.95) {
    confidence = clamp(confidence + 0.15, 0, 1);
    detectors.push('UNREGISTERED_ROGUE_TAC');
  }

  return {
    id: simpleId(),
    timestamp: cell.timestamp,
    tier: 1,
    threat_level: threatFromConfidence(confidence),
    confidence,
    detectors_fired: detectors,
    cell_info: cell,
    cid: cell.cid,
    enb_id: enbId,
    tac: cell.tac,
    mcc: cell.mcc,
    mnc: cell.mnc,
    rsrp: cell.rsrp,
    rsrq: cell.rsrq,
  };
};

// ─── Tier 2: Shannon event scoring ───────────────────────────────────────────

export const scoreShannonEvent = (event: ShannonEvent): DetectionResult => {
  const detectors: string[] = [];
  let confidence = 0;

  // Shannon reported a CID we know is rogue
  if (event.cid !== undefined && isCidRogue(event.cid)) {
    confidence = 1.0;
    detectors.push('SHANNON_ROGUE_CID');
  }

  // Shannon reported rogue eNB via CID
  if (event.cid !== undefined && isEnbRogue(enbFromCid(event.cid))) {
    confidence = clamp(Math.max(confidence, 0.99), 0, 1);
    detectors.push('SHANNON_ROGUE_ENB');
  }

  // IMS support service event — worth noting even without confirmed CID
  if (
    event.event_type === 'IMS_SUPPORT_SERVICE' ||
    event.raw_line.includes('RILC_UNSOL_IMS_SUPPORT_SERVICE')
  ) {
    confidence = clamp(confidence + 0.3, 0, 1);
    detectors.push('SHANNON_IMS_SUPPORT_SERVICE');
  }

  // Identity request in Shannon log
  if (
    event.raw_line.toLowerCase().includes('identity_request') ||
    event.raw_line.toLowerCase().includes('identity request')
  ) {
    confidence = clamp(confidence + 0.4, 0, 1);
    detectors.push('SHANNON_IDENTITY_REQUEST');
  }

  return {
    id: simpleId(),
    timestamp: event.timestamp,
    tier: 2,
    threat_level: threatFromConfidence(confidence),
    confidence,
    detectors_fired: detectors,
    shannon_event: event,
    cid: event.cid,
    enb_id: event.cid !== undefined ? enbFromCid(event.cid) : undefined,
  };
};

// ─── Detection history deduplication ─────────────────────────────────────────

const DEDUP_WINDOW_MS = 30 * 1000; // 30 seconds
const _recentDetections: Map<string, number> = new Map();

/**
 * Returns true if this detection is new (not seen in dedup window).
 * Key: cid+tac+tier combination.
 */
export const isNewDetection = (result: DetectionResult): boolean => {
  const key = `${result.cid ?? 'x'}-${result.tac ?? 'x'}-${result.tier}`;
  const now = Date.now();
  const last = _recentDetections.get(key);

  if (last && now - last < DEDUP_WINDOW_MS) return false;

  _recentDetections.set(key, now);

  // Prune stale entries
  for (const [k, t] of _recentDetections.entries()) {
    if (now - t > DEDUP_WINDOW_MS * 2) _recentDetections.delete(k);
  }

  return true;
};
