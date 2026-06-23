/**
 * index.ts — cell-monitor module public JS interface (v3.0 legacy NativeModule)
 */

import { NativeModules, NativeEventEmitter } from 'react-native';

import type {
  NativeCellInfo,
  CellInfoUpdateEvent,
  NativeShannonEvent,
  NativeThreatEvent,
  CallStateEvent,
  OverlayActionEvent,
} from './src/CellMonitor.types';

export type {
  NativeCellInfo,
  CellInfoUpdateEvent,
  NativeShannonEvent,
  NativeThreatEvent,
  CallStateEvent,
  OverlayActionEvent,
} from './src/CellMonitor.types';

const CellMonitor = NativeModules.CellMonitor;

if (!CellMonitor) {
  console.error('[cell-monitor] Native module CellMonitor is null — not registered.');
}

const emitter = CellMonitor ? new NativeEventEmitter(CellMonitor) : null;

// ── Tier 1: CellInfo ──────────────────────────────────────────────────
export const startMonitoring = (): Promise<boolean> => CellMonitor.startMonitoring();
export const stopMonitoring = (): Promise<void> => CellMonitor.stopMonitoring();
export const triggerImmediateScan = (): Promise<void> => CellMonitor.triggerImmediateScan();

// ── Tier 2: Shannon ───────────────────────────────────────────────────
export const startShannonStream = (): Promise<void> => CellMonitor.startShannonStream();
export const stopShannonStream = (): Promise<void> => CellMonitor.stopShannonStream();

// ── Call state ────────────────────────────────────────────────────────
export const startCallMonitoring = (): Promise<void> => CellMonitor.startCallMonitoring();
export const stopCallMonitoring = (): Promise<void> => CellMonitor.stopCallMonitoring();
export const getCurrentCallState = (): Promise<number> => CellMonitor.getCurrentCallState();

// ── Overlay ───────────────────────────────────────────────────────────
export const showClearOverlay = (): Promise<void> => CellMonitor.showClearOverlay();
export const showThreatOverlay = (confidence: number, detectors: string): Promise<void> =>
  CellMonitor.showThreatOverlay(confidence, detectors);
export const dismissOverlay = (): Promise<void> => CellMonitor.dismissOverlay();
export const isOverlayPermissionGranted = (): Promise<boolean> =>
  CellMonitor.isOverlayPermissionGranted();

// ── Permissions ───────────────────────────────────────────────────────
export const isReadLogsGranted = (): Promise<boolean> => CellMonitor.isReadLogsGranted();
export const requestTier1Permissions = (): Promise<boolean> => CellMonitor.requestTier1Permissions();

// ── Event listeners ───────────────────────────────────────────────────
export const addCellInfoListener = (listener: (event: CellInfoUpdateEvent) => void) =>
  emitter?.addListener('onCellInfoUpdate', listener) ?? { remove: () => {} };

export const addShannonEventListener = (listener: (event: NativeShannonEvent) => void) =>
  emitter?.addListener('onShannonEvent', listener) ?? { remove: () => {} };

export const addThreatListener = (listener: (event: NativeThreatEvent) => void) =>
  emitter?.addListener('onThreatDetected', listener) ?? { remove: () => {} };

export const addCallStateListener = (listener: (event: CallStateEvent) => void) =>
  emitter?.addListener('onCallStateChange', listener) ?? { remove: () => {} };

export const addOverlayActionListener = (listener: (event: OverlayActionEvent) => void) =>
  emitter?.addListener('onOverlayAction', listener) ?? { remove: () => {} };