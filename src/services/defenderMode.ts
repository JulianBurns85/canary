/**
 * defenderMode.ts — Canary v3.0 Defender Mode (with call-aware queue)
 *
 * Three trigger paths:
 *   1. AUTO (no call)       → fires immediately on confirmed THREAT
 *   2. DEFEND_NOW (on call) → user chose to fire immediately from overlay
 *   3. DEFEND_AFTER_CALL    → queued, fires the moment call ends (IDLE)
 *
 * All paths use /api/defender/trigger with {"type": "DATA_CYCLE", "cid": "..."}
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DetectionResult } from './detectionEngine';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFENDER_LOG_KEY    = '@canary/defender_actions';
const MAX_LOG_ENTRIES     = 500;
const TRIGGER_THRESHOLD   = 0.80;
const COOLDOWN_MS         = 60 * 1000;
const GLOBAL_COOLDOWN_MS = 5 * 60 * 1000;  // 5 min global gate

const CASTNET_ENDPOINTS = [
  'http://100.68.146.48:5000',
  'http://192.168.1.239:5000',
];
const DEFENDER_SECRET = 'd996963102ab5910db4e856b78c50d913caae8541ebf709fdc91f33339c5e326';

// ─── State ────────────────────────────────────────────────────────────────────

let _enabled = true;
const _cooldowns = new Map<string, number>();
let _lastGlobalFire = 0;
let _queuedDetection: DetectionResult | null = null;

// ─── Types ────────────────────────────────────────────────────────────────────

export type DefenderTriggerReason =
  | 'AUTO'
  | 'DEFEND_NOW'
  | 'DEFEND_AFTER_CALL';

export interface DefenderAction {
  id: string;
  timestamp: number;
  reason: DefenderTriggerReason;
  detection_confidence: number;
  threat_level: string;
  detectors_fired: string[];
  cid?: number;
  enb_id?: number;
  pi_notified: boolean;
}

// ─── Enable / disable ─────────────────────────────────────────────────────────

export const setDefenderEnabled = (v: boolean): void => { _enabled = v; };
export const isDefenderEnabled  = (): boolean => _enabled;

// ─── Queue ────────────────────────────────────────────────────────────────────

/** Queue a detection to fire after the current call ends. */
export const queueDefenderPostCall = (result: DetectionResult): void => {
  _queuedDetection = result;
};

/** Fire the queued detection (call IDLE handler). Silent no-op if nothing queued. */
export const fireQueuedDefender = async (): Promise<DefenderAction | null> => {
  if (!_queuedDetection) return null;
  const queued = _queuedDetection;
  _queuedDetection = null;
  return _fire(queued, 'DEFEND_AFTER_CALL');
};

/** Clear queue without firing (e.g. if threat resolved while on call). */
export const clearQueuedDefender = (): void => {
  _queuedDetection = null;
};

export const hasQueuedDefender = (): boolean => _queuedDetection !== null;

// ─── Main trigger ─────────────────────────────────────────────────────────────

/**
 * Auto-evaluate and trigger. Returns null if suppressed.
 * Does NOT fire during RINGING or OFFHOOK — call state handled by orchestrator.
 */
export const evaluateAndTrigger = async (
  result: DetectionResult
): Promise<DefenderAction | null> => {
  if (!_enabled) return null;
  if (result.confidence < TRIGGER_THRESHOLD) return null;
  return _fire(result, 'AUTO');
};

/** Direct fire — for DEFEND_NOW action from overlay. */
export const fireDefendNow = async (
  result: DetectionResult
): Promise<DefenderAction | null> => {
  return _fire(result, 'DEFEND_NOW');
};

// ─── Core fire ────────────────────────────────────────────────────────────────

const _fire = async (
  result: DetectionResult,
  reason: DefenderTriggerReason
): Promise<DefenderAction | null> => {
  // Cooldown check (skip for manual DEFEND_NOW)
  if (reason !== 'DEFEND_NOW') {
    const now = Date.now();
    if (now - _lastGlobalFire < GLOBAL_COOLDOWN_MS) return null;
    const key = `${result.cid ?? 'x'}-${result.enb_id ?? 'x'}`;
    const last = _cooldowns.get(key) ?? 0;
    if (now - last < COOLDOWN_MS) return null;
    _lastGlobalFire = now;
    _cooldowns.set(key, now);
  }

  // POST to Pi — correct v1 endpoint with expected payload format
  const piNotified = await _postCountermeasure(result);

  const action: DefenderAction = {
    id: `def-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    reason,
    detection_confidence: result.confidence,
    threat_level: result.threat_level,
    detectors_fired: result.detectors_fired,
    cid: result.cid,
    enb_id: result.enb_id,
    pi_notified: piNotified,
  };

  void _logAction(action);
  return action;
};

const _postCountermeasure = async (result: DetectionResult): Promise<boolean> => {
  const payload = {
    type: 'DATA_CYCLE',
    cid: result.cid?.toString() ?? 'unknown',
    source: 'canary_v3',
    confidence: result.confidence,
    detectors: result.detectors_fired,
    timestamp: new Date().toISOString(),
  };

  for (const base of CASTNET_ENDPOINTS) {
    try {
      const res = await fetch(`${base}/api/defender/trigger`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Canary-Secret': DEFENDER_SECRET },
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(8000),
      });
      if (res.ok) return true;
    } catch {
      continue;
    }
  }
  return false;
};

// ─── Log ─────────────────────────────────────────────────────────────────────

const _logAction = async (action: DefenderAction): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(DEFENDER_LOG_KEY);
    const log: DefenderAction[] = raw ? JSON.parse(raw) : [];
    log.unshift(action);
    if (log.length > MAX_LOG_ENTRIES) log.splice(MAX_LOG_ENTRIES);
    await AsyncStorage.setItem(DEFENDER_LOG_KEY, JSON.stringify(log));
  } catch { /* silent */ }
};

export const getDefenderLog = async (): Promise<DefenderAction[]> => {
  try {
    const raw = await AsyncStorage.getItem(DEFENDER_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

export const clearDefenderLog = async (): Promise<void> => {
  try { await AsyncStorage.removeItem(DEFENDER_LOG_KEY); } catch { /* silent */ }
};
