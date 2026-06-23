/**
 * monitorOrchestrator.ts — Canary v3.0 (with call state + overlay)
 *
 * Boot sequence:
 *   1. Init rogue database
 *   2. Start Tier 1 polling
 *   3. Start Tier 2 if READ_LOGS granted
 *   4. Start call state monitoring
 *   5. Wire all events
 *   6. Heartbeat
 *
 * Call state logic:
 *   RINGING  → immediate scan triggered by native, overlay shown with last known threat state
 *   OFFHOOK  → auto-defender suppressed, queue used instead
 *   IDLE     → fire any queued defender (post-call defence)
 */

import {
  startMonitoring,
  stopMonitoring,
  startShannonStream,
  stopShannonStream,
  startCallMonitoring,
  stopCallMonitoring,
  showClearOverlay,
  showThreatOverlay,
  dismissOverlay,
  isReadLogsGranted,
  isOverlayPermissionGranted,
  addCellInfoListener,
  addShannonEventListener,
  addCallStateListener,
  addOverlayActionListener,
  CALL_STATE_IDLE,
  CALL_STATE_RINGING,
  CALL_STATE_OFFHOOK,
} from 'cell-monitor';
import type { Subscription } from 'expo-modules-core';

import { initRogueDatabase, refreshRemoteDb } from './rogueDatabase';
import {
  scoreCellInfo,
  scoreShannonEvent,
  isNewDetection,
} from './detectionEngine';
import type { DetectionResult, RawCellInfo, ShannonEvent } from './detectionEngine';
import {
  evaluateAndTrigger,
  fireDefendNow,
  queueDefenderPostCall,
  fireQueuedDefender,
  clearQueuedDefender,
} from './defenderMode';
import { saveDetection } from './detectionHistory';
import { postDetection, postHeartbeat } from './castnetApi';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrchestratorCallback = (
  result: DetectionResult,
  tier2Active: boolean
) => void;

export type CallStateCallback = (
  callState: number,
  label: string
) => void;

interface OrchestratorState {
  running:          boolean;
  tier2Active:      boolean;
  overlayAvailable: boolean;
  callState:        number;
  lastResult:       DetectionResult | null;
  subscriptions:    Subscription[];
}

// ─── State ────────────────────────────────────────────────────────────────────

const state: OrchestratorState = {
  running:          false,
  tier2Active:      false,
  overlayAvailable: false,
  callState:        CALL_STATE_IDLE,
  lastResult:       null,
  subscriptions:    [],
};

// ─── Detection handler ────────────────────────────────────────────────────────

const handleDetection = async (
  result: DetectionResult,
  onDetection: OrchestratorCallback
): Promise<void> => {
  if (!isNewDetection(result)) return;

  state.lastResult = result;

  await saveDetection(result);

  void postDetection({
    version:         '3.0.0',
    timestamp:       new Date(result.timestamp).toISOString(),
    tier:            result.tier,
    detection_type:  result.detectors_fired[0] ?? 'UNKNOWN',
    confidence:      result.confidence,
    threat_level:    result.threat_level,
    cid:             result.cid,
    enb_id:          result.enb_id,
    tac:             result.tac,
    mcc:             result.mcc,
    mnc:             result.mnc,
    rsrp:            result.rsrp,
    rsrq:            result.rsrq,
    detectors_fired: result.detectors_fired,
    raw_shannon:     result.shannon_event?.raw_line,
  });

  // ── Call-aware defender logic ──────────────────────────────────────────────
  if (state.callState === CALL_STATE_IDLE) {
    // Normal path — auto-defender
    void evaluateAndTrigger(result);
  } else {
    // On call — queue for post-call, don't auto-fire
    if (result.confidence >= 0.8) {
      queueDefenderPostCall(result);
    }
  }

  onDetection(result, state.tier2Active);
};

// ─── Call state handler ───────────────────────────────────────────────────────

const handleCallStateChange = async (
  callState: number,
  onCallState: CallStateCallback
): Promise<void> => {
  const prev = state.callState;
  state.callState = callState;

  onCallState(callState, ['IDLE', 'RINGING', 'OFFHOOK'][callState] ?? 'UNKNOWN');

  if (callState === CALL_STATE_RINGING && state.overlayAvailable) {
    // Show overlay based on last known threat level
    const last = state.lastResult;
    if (last && last.threat_level !== 'CLEAR') {
      await showThreatOverlay(
        last.confidence,
        last.detectors_fired.slice(0, 2).join(' · ')
      );
    } else {
      await showClearOverlay();
    }
  }

  if (callState === CALL_STATE_OFFHOOK) {
    // Call answered — dismiss overlay
    await dismissOverlay();
  }

  if (callState === CALL_STATE_IDLE && prev !== CALL_STATE_IDLE) {
    // Call ended — fire any queued defender
    await dismissOverlay();
    const action = await fireQueuedDefender();
    if (action) {
      console.log(`[Canary] Post-call defender fired: ${action.id}`);
    }
  }
};

// ─── Overlay action handler ───────────────────────────────────────────────────

const handleOverlayAction = async (action: string): Promise<void> => {
  const last = state.lastResult;

  if (action === 'DEFEND_NOW' && last) {
    // User chose to defend immediately during call
    void fireDefendNow(last);
    clearQueuedDefender();
  }
  // DEFEND_AFTER_CALL: already queued by handleDetection, nothing more to do
};

// ─── Start / stop ─────────────────────────────────────────────────────────────

export const startOrchestrator = async (
  onDetection: OrchestratorCallback,
  onCallState: CallStateCallback
): Promise<{ tier2Active: boolean; overlayAvailable: boolean }> => {
  if (state.running) {
    return {
      tier2Active:      state.tier2Active,
      overlayAvailable: state.overlayAvailable,
    };
  }

  await initRogueDatabase();

  await startMonitoring();

  const [readLogs, overlay] = await Promise.all([
    isReadLogsGranted(),
    isOverlayPermissionGranted(),
  ]);

  if (readLogs) {
    await startShannonStream();
    state.tier2Active = true;
  }

  state.overlayAvailable = overlay;

  try { await startCallMonitoring(); } catch { /* GrapheneOS may restrict phone access */ }

  // ── Wire events ───────────────────────────────────────────────────────────

  const cellSub = addCellInfoListener(async (event) => {
    // Native emits cells as cell_0, cell_1... bundles
    const cells = parseCellBundles(event);
    for (const cell of cells) {
      const result = scoreCellInfo(cell);
      if (result.threat_level !== 'CLEAR') {
        await handleDetection(result, onDetection);
      }
    }
  });

  const shannonSub = addShannonEventListener(async (event) => {
    const result = scoreShannonEvent(event as unknown as ShannonEvent);
    if (result.confidence > 0.1) {
      await handleDetection(result, onDetection);
    }
  });

  const callSub = addCallStateListener(async (event) => {
    await handleCallStateChange(event.call_state, onCallState);
  });

  const overlaySub = addOverlayActionListener(async (event) => {
    await handleOverlayAction(event.action);
  });

  state.subscriptions = [cellSub, shannonSub, callSub, overlaySub];
  state.running = true;

  void postHeartbeat();

  return { tier2Active: state.tier2Active, overlayAvailable: state.overlayAvailable };
};

export const stopOrchestrator = async (): Promise<void> => {
  for (const sub of state.subscriptions) sub.remove();
  state.subscriptions = [];
  await Promise.all([stopMonitoring(), stopShannonStream(), stopCallMonitoring()]);
  state.running = false;
  state.tier2Active = false;
};

export const activateTier2 = async (): Promise<boolean> => {
  const granted = await isReadLogsGranted();
  if (!granted) return false;
  await startShannonStream();
  state.tier2Active = true;
  return true;
};

export const refreshOverlayPermission = async (): Promise<boolean> => {
  state.overlayAvailable = await isOverlayPermissionGranted();
  return state.overlayAvailable;
};

export const isTier2Active          = (): boolean => state.tier2Active;
export const isOverlayAvailable     = (): boolean => state.overlayAvailable;
export const forceDbRefresh         = async (): Promise<void> => refreshRemoteDb();

// ─── Cell bundle parser ───────────────────────────────────────────────────────

/**
 * Native CellInfoService emits cells as cell_0, cell_1... bundle entries.
 * This converts that back to a typed array.
 */
const parseCellBundles = (event: any): RawCellInfo[] => {
  const count: number = event.cell_count ?? 0;
  const cells: RawCellInfo[] = [];

  for (let i = 0; i < count; i++) {
    const c = event[`cell_${i}`];
    if (!c) continue;
    cells.push({
      type:       c.type ?? 'LTE',
      cid:        c.cid  ?? 0,
      pci:        c.pci  ?? 0,
      tac:        c.tac  ?? 0,
      mcc:        c.mcc  ?? '',
      mnc:        c.mnc  ?? '',
      earfcn:     c.earfcn ?? 0,
      rsrp:       c.rsrp  ?? -120,
      rsrq:       c.rsrq  ?? -20,
      registered: c.registered ?? false,
      timestamp:  c.timestamp  ?? Date.now(),
    });
  }

  return cells;
};
