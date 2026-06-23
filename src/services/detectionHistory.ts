/**
 * detectionHistory.ts — Canary v3 detection history persistence
 *
 * Stores up to MAX_ENTRIES detections in AsyncStorage.
 * Newest first. Trims automatically.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DetectionResult } from './detectionEngine';

const HISTORY_KEY = '@canary/detection_history';
const MAX_ENTRIES = 1000;

// ─── Save ─────────────────────────────────────────────────────────────────────

export const saveDetection = async (result: DetectionResult): Promise<void> => {
  if (result.threat_level === 'CLEAR') return; // Only persist non-clear events

  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const history: DetectionResult[] = raw ? JSON.parse(raw) : [];

    history.unshift(result);

    if (history.length > MAX_ENTRIES) {
      history.splice(MAX_ENTRIES);
    }

    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Fail silently
  }
};

// ─── Query ────────────────────────────────────────────────────────────────────

export const getDetectionHistory = async (
  limit = 100
): Promise<DetectionResult[]> => {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const history: DetectionResult[] = raw ? JSON.parse(raw) : [];
    return history.slice(0, limit);
  } catch {
    return [];
  }
};

export const getTodayDetectionCount = async (): Promise<number> => {
  try {
    const history = await getDetectionHistory(MAX_ENTRIES);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const cutoff = startOfDay.getTime();
    return history.filter((d) => d.timestamp >= cutoff).length;
  } catch {
    return 0;
  }
};

export const clearDetectionHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
  } catch {
    // Fail silently
  }
};
