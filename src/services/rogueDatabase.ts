/**
 * rogueDatabase.ts — Rogue cell database manager
 *
 * Strategy:
 *   - Local baseline (rogue_db.json) always available offline
 *   - Remote CASTNET updates fetched on init and every 6h
 *   - Remote merged into local — local is never overwritten
 *   - Remote cache persisted to AsyncStorage
 *   - All failures silent — local baseline always covers
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchRemoteRogueDb } from './castnetApi';

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_KEY = '@canary/rogue_db_remote';
const CACHE_TIME_KEY = '@canary/rogue_db_remote_time';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RogueCell {
  id: string;
  platform: string;
  enb_id: number;
  cid: number | null;
  tac: number;
  mcc: string;
  mnc: string;
  spoofed_operator: string;
  confidence: number;
  yaicd: number;
  triple_confirmed: boolean;
}

export interface SpoofedOperator {
  mcc: string;
  mnc: string;
  legitimate_operator: string;
  note: string;
}

export interface TimingSignature {
  label: string;
  interval_s: number;
  mean_s?: number;
  cv_pct: number;
  sample_count: number;
}

export interface DetectionThresholds {
  rsrp_anomaly_strong_dbm: number;
  rsrq_anomaly_strong_db: number;
  band_copresence_min_delta_s: number;
  yaicd_threat_threshold: number;
  confidence_threat: number;
  confidence_high: number;
  confidence_suspicious: number;
}

export interface RogueDatabase {
  schema: string;
  version: string;
  last_updated: string;
  rogue_cids: number[];
  rogue_enbs: number[];
  rogue_tacs: number[];
  rogue_cells: RogueCell[];
  spoofed_operators: SpoofedOperator[];
  timing_signatures: {
    device_a_harris: TimingSignature;
    device_b_srsran: TimingSignature;
  };
  detection_thresholds: DetectionThresholds;
}

// ─── State ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-var-requires
const LOCAL_BASELINE: RogueDatabase = require('../../assets/rogue_db.json');

let _activeDb: RogueDatabase = { ...LOCAL_BASELINE };
let _refreshTimer: ReturnType<typeof setInterval> | null = null;

// ─── Merge ───────────────────────────────────────────────────────────────────

const mergeIntoLocal = (remote: Partial<RogueDatabase>): RogueDatabase => {
  const merged: RogueDatabase = { ...LOCAL_BASELINE };

  if (remote.rogue_cids?.length) {
    merged.rogue_cids = Array.from(
      new Set([...LOCAL_BASELINE.rogue_cids, ...remote.rogue_cids])
    );
  }

  if (remote.rogue_enbs?.length) {
    merged.rogue_enbs = Array.from(
      new Set([...LOCAL_BASELINE.rogue_enbs, ...remote.rogue_enbs])
    );
  }

  if (remote.rogue_tacs?.length) {
    merged.rogue_tacs = Array.from(
      new Set([...LOCAL_BASELINE.rogue_tacs, ...remote.rogue_tacs])
    );
  }

  if (remote.rogue_cells?.length) {
    const existingIds = new Set(LOCAL_BASELINE.rogue_cells.map((c) => c.id));
    const newCells = (remote.rogue_cells as RogueCell[]).filter(
      (c) => !existingIds.has(c.id)
    );
    merged.rogue_cells = [...LOCAL_BASELINE.rogue_cells, ...newCells];
  }

  if (remote.version) {
    merged.version = remote.version;
    merged.last_updated = remote.last_updated ?? merged.last_updated;
  }

  return merged;
};

// ─── Remote refresh ───────────────────────────────────────────────────────────

export const refreshRemoteDb = async (): Promise<void> => {
  try {
    const remote = await fetchRemoteRogueDb();
    if (!remote) return;

    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(remote));
    await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    _activeDb = mergeIntoLocal(remote);
  } catch {
    // Fail silently
  }
};

// ─── Init ────────────────────────────────────────────────────────────────────

export const initRogueDatabase = async (): Promise<void> => {
  try {
    // Load any cached remote data first (fast path - no network)
    const [cachedRaw, cacheTimeRaw] = await Promise.all([
      AsyncStorage.getItem(CACHE_KEY),
      AsyncStorage.getItem(CACHE_TIME_KEY),
    ]);

    if (cachedRaw && cacheTimeRaw) {
      const age = Date.now() - parseInt(cacheTimeRaw, 10);
      if (age < CACHE_TTL_MS) {
        _activeDb = mergeIntoLocal(JSON.parse(cachedRaw));
      }
    }

    // Fire off a fresh remote fetch in background
    void refreshRemoteDb();

    // Schedule 6-hour refresh cycle
    if (_refreshTimer) clearInterval(_refreshTimer);
    _refreshTimer = setInterval(() => {
      void refreshRemoteDb();
    }, CACHE_TTL_MS);
  } catch {
    // Local baseline always covers
    _activeDb = { ...LOCAL_BASELINE };
  }
};

// ─── Query API ────────────────────────────────────────────────────────────────

export const getActiveDb = (): RogueDatabase => _activeDb;

export const isCidRogue = (cid: number): boolean =>
  _activeDb.rogue_cids.includes(cid);

export const isEnbRogue = (enbId: number): boolean =>
  _activeDb.rogue_enbs.includes(enbId);

export const isTacRogue = (tac: number): boolean =>
  _activeDb.rogue_tacs.includes(tac);

export const enbFromCid = (cid: number): number => Math.floor(cid / 256);

/**
 * Operator spoof check: right MCC/MNC but rogue TAC = impersonation.
 * MCC/MNC alone is not enough — legitimate Telstra/Vodafone cells exist.
 */
export const isOperatorSpoofed = (
  mcc: string,
  mnc: string,
  tac: number
): boolean => {
  const spoofed = _activeDb.spoofed_operators.find(
    (s) => s.mcc === mcc && s.mnc === mnc
  );
  if (!spoofed) return false;
  return isTacRogue(tac);
};

export const getDetectionThresholds = (): DetectionThresholds =>
  _activeDb.detection_thresholds;
