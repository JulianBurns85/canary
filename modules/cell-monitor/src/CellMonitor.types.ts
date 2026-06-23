/**
 * CellMonitor.types.ts — Types shared between native module and JS layer
 */

/** Raw cell info emitted by Tier 1 (CellInfoService.kt) */
export interface NativeCellInfo {
  type: 'LTE' | 'NR' | 'WCDMA' | 'GSM';
  cid: number;
  pci: number;
  tac: number;
  mcc: string;
  mnc: string;
  earfcn: number;
  rsrp: number;       // dBm
  rsrq: number;       // dB
  registered: boolean;
  timestamp: number;  // epoch ms
}

/** Event payload for onCellInfoUpdate */
export interface CellInfoUpdateEvent {
  cells: NativeCellInfo[];
}

/** Raw Shannon logcat event emitted by Tier 2 (ShannonLogcatService.kt) */
export interface NativeShannonEvent {
  raw_line: string;
  cid?: number;
  event_type?: string;
  threat: boolean;
  timestamp: number;
  tier: 2;
}

/** Generic threat alert from either tier */
export interface NativeThreatEvent {
  tier: 1 | 2;
  cid?: number;
  tac?: number;
  confidence: number;
  detector: string;
  timestamp: number;
}

export type CellMonitorEventMap = {
  onCellInfoUpdate: CellInfoUpdateEvent;
  onShannonEvent: NativeShannonEvent;
  onThreatDetected: NativeThreatEvent;
};
/** Event payload for onCallStateChange */
export interface CallStateEvent {
  state: number;       // 0 = idle, 1 = ringing, 2 = offhook
  timestamp: number;
}

/** Event payload for onOverlayAction */
export interface OverlayActionEvent {
  action: string;
  timestamp: number;
}