/**
 * castnetApi.ts — CASTNET API client for Canary v3
 *
 * Pi "overkill":
 *   Tailscale: 100.68.146.48:5000  (primary)
 *   Local:     192.168.1.239:5000  (fallback)
 *
 * Custom Pi URL can be set by user in Settings and is persisted via AsyncStorage.
 * It is tried first before the defaults.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_PI_URL = '@canary/pi_url';

const DEFAULT_ENDPOINTS = [
  'http://100.68.146.48:5000',
  'http://192.168.1.239:5000',
];

const TIMEOUT_MS = 8000;
const APP_NODE_ID = 'canary_pixel9_fold';

// ─── Custom Pi URL (in-memory cache, loaded lazily) ──────────────────────────

let _cachedPiUrl: string | null | undefined = undefined; // undefined = not yet loaded

const getEndpoints = async (): Promise<string[]> => {
  if (_cachedPiUrl === undefined) {
    try {
      _cachedPiUrl = await AsyncStorage.getItem(STORAGE_KEY_PI_URL);
    } catch {
      _cachedPiUrl = null;
    }
  }
  if (_cachedPiUrl) return [_cachedPiUrl, ...DEFAULT_ENDPOINTS];
  return DEFAULT_ENDPOINTS;
};

export const getCustomPiUrl = async (): Promise<string | null> => {
  if (_cachedPiUrl === undefined) {
    try {
      _cachedPiUrl = await AsyncStorage.getItem(STORAGE_KEY_PI_URL);
    } catch {
      _cachedPiUrl = null;
    }
  }
  return _cachedPiUrl ?? null;
};

export const setCustomPiUrl = async (url: string): Promise<void> => {
  const trimmed = url.trim();
  _cachedPiUrl = trimmed || null;
  try {
    if (trimmed) {
      await AsyncStorage.setItem(STORAGE_KEY_PI_URL, trimmed);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY_PI_URL);
    }
  } catch { /* silent */ }
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CastnetDetectionPayload {
  node_id: string;
  app: 'canary';
  version: string;
  timestamp: string;
  tier: 1 | 2;
  detection_type: string;
  confidence: number;
  threat_level: 'CLEAR' | 'SUSPICIOUS' | 'HIGH' | 'THREAT';
  cid?: number;
  enb_id?: number;
  tac?: number;
  mcc?: string;
  mnc?: string;
  rsrp?: number;
  rsrq?: number;
  detectors_fired: string[];
  raw_shannon?: string;
}

export interface CastnetRogueDbResponse {
  schema: string;
  version: string;
  last_updated: string;
  rogue_cids: number[];
  rogue_enbs: number[];
  rogue_tacs: number[];
  rogue_cells: unknown[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const withTimeout = (ms: number): AbortSignal => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
};

/**
 * Tries each endpoint in order until one succeeds.
 * Fails silently — never throws.
 */
const fetchFromAny = async (
  path: string,
  init: RequestInit = {}
): Promise<Response | null> => {
  const endpoints = await getEndpoints();
  for (const base of endpoints) {
    try {
      const response = await fetch(`${base}${path}`, {
        ...init,
        signal: withTimeout(TIMEOUT_MS),
      });
      if (response.ok) return response;
    } catch {
      // Try next endpoint
    }
  }
  return null;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Test connection to Pi. Returns the URL that responded or null.
 */
export const testPiConnection = async (): Promise<string | null> => {
  const endpoints = await getEndpoints();
  for (const base of endpoints) {
    try {
      const res = await fetch(`${base}/api/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: APP_NODE_ID, app: 'canary', test: true }),
        signal: withTimeout(4000),
      });
      if (res.ok) return base;
    } catch {
      continue;
    }
  }
  return null;
};

/**
 * Post a detection event to CASTNET. Silent fail if Pi unreachable.
 */
export const postDetection = async (
  payload: Omit<CastnetDetectionPayload, 'node_id' | 'app'>
): Promise<boolean> => {
  const body: CastnetDetectionPayload = {
    ...payload,
    node_id: APP_NODE_ID,
    app: 'canary',
  };

  const res = await fetchFromAny('/api/detection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return res !== null;
};

/**
 * Fetch the latest rogue DB from CASTNET. Returns null if unreachable.
 */
export const fetchRemoteRogueDb =
  async (): Promise<CastnetRogueDbResponse | null> => {
    const res = await fetchFromAny('/api/rogue_db');
    if (!res) return null;

    try {
      return (await res.json()) as CastnetRogueDbResponse;
    } catch {
      return null;
    }
  };

/**
 * Trigger defender mode countermeasure on Pi. Silent fail if unreachable.
 */
export const triggerDefenderRemote = async (payload: {
  confidence: number;
  threat_level: string;
  detectors_fired: string[];
  cid?: number;
  enb_id?: number;
}): Promise<boolean> => {
  const res = await fetchFromAny('/api/defender/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      node_id: APP_NODE_ID,
      source: 'canary',
      timestamp: new Date().toISOString(),
      ...payload,
    }),
  });

  return res !== null;
};

/**
 * Check if Pi ADB connection to Pixel is active.
 */
export const getAdbStatus = async (): Promise<{ connected: boolean; devices: string[] } | null> => {
  const endpoints = await getEndpoints();
  for (const base of endpoints) {
    try {
      const res = await fetch(`${base}/api/adb/status`, {
        signal: withTimeout(4000),
      });
      if (res.ok) {
        const data = await res.json() as { connected: boolean; devices: string[] };
        return data;
      }
    } catch {
      continue;
    }
  }
  return null;
};

/**
 * Send heartbeat so Pi knows Canary is active. Silent fail.
 */
export const postHeartbeat = async (): Promise<boolean> => {
  const res = await fetchFromAny('/api/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      node_id: APP_NODE_ID,
      app: 'canary',
      version: '3.0.0',
      timestamp: new Date().toISOString(),
    }),
  });

  return res !== null;
};
