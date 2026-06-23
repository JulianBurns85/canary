/**
 * CanaryContext.tsx — Canary v3.0 (with call state)
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { DetectionResult, ThreatLevel } from '../services/detectionEngine';
import {
  startOrchestrator,
  stopOrchestrator,
  activateTier2,
  isOverlayAvailable,
  refreshOverlayPermission,
  forceDbRefresh,
} from '../services/monitorOrchestrator';
import { getTodayDetectionCount } from '../services/detectionHistory';
import { isDefenderEnabled, setDefenderEnabled } from '../services/defenderMode';
import { CALL_STATE_IDLE } from 'cell-monitor';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CanaryContextValue {
  threatLevel:      ThreatLevel;
  lastDetection:    DetectionResult | null;
  lastScanTime:     Date | null;
  todayCount:       number;
  tier2Active:      boolean;
  overlayAvailable: boolean;
  defenderEnabled:  boolean;
  callState:        number;
  callStateLabel:   string;
  initialised:      boolean;

  enableTier2:            () => Promise<boolean>;
  checkOverlayPermission: () => Promise<boolean>;
  toggleDefender:         (enabled: boolean) => void;
  refreshDb:              () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CanaryContext = createContext<CanaryContextValue | null>(null);

export const useCanary = (): CanaryContextValue => {
  const ctx = useContext(CanaryContext);
  if (!ctx) throw new Error('useCanary must be inside CanaryProvider');
  return ctx;
};

// ─── Provider ────────────────────────────────────────────────────────────────

export const CanaryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [threatLevel,      setThreatLevel]      = useState<ThreatLevel>('CLEAR');
  const [lastDetection,    setLastDetection]     = useState<DetectionResult | null>(null);
  const [lastScanTime,     setLastScanTime]      = useState<Date | null>(null);
  const [todayCount,       setTodayCount]        = useState(0);
  const [tier2Active,      setTier2Active]       = useState(false);
  const [overlayAvailable, setOverlayAvailable]  = useState(false);
  const [defenderEnabled,  setDefenderState]     = useState(true);
  const [callState,        setCallState]         = useState(CALL_STATE_IDLE);
  const [callStateLabel,   setCallStateLabel]    = useState('IDLE');
  const [initialised,      setInitialised]       = useState(false);

  const countRef = useRef(0);

  const onDetection = useCallback((result: DetectionResult, t2: boolean) => {
    setThreatLevel(result.threat_level);
    setLastDetection(result);
    setLastScanTime(new Date());
    setTier2Active(t2);
    countRef.current += 1;
    setTodayCount(countRef.current);
  }, []);

  const onCallState = useCallback((state: number, label: string) => {
    setCallState(state);
    setCallStateLabel(label);
  }, []);

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      try {
        const count = await getTodayDetectionCount();
        if (mounted) { countRef.current = count; setTodayCount(count); }

        const { tier2Active: t2, overlayAvailable: oa } =
          await startOrchestrator(onDetection, onCallState);

        if (mounted) {
          setTier2Active(t2);
          setOverlayAvailable(oa);
          setDefenderState(isDefenderEnabled());
          setLastScanTime(new Date());
          setInitialised(true);
        }
      } catch {
        if (mounted) setInitialised(true);
      }
    };

    void boot();
    return () => {
      mounted = false;
      void stopOrchestrator();
    };
  }, [onDetection, onCallState]);

  const enableTier2 = useCallback(async () => {
    const ok = await activateTier2();
    if (ok) setTier2Active(true);
    return ok;
  }, []);

  const checkOverlayPermission = useCallback(async () => {
    const ok = await refreshOverlayPermission();
    setOverlayAvailable(ok);
    return ok;
  }, []);

  const toggleDefender = useCallback((enabled: boolean) => {
    setDefenderEnabled(enabled);
    setDefenderState(enabled);
  }, []);

  const refreshDb = useCallback(async () => {
    await forceDbRefresh();
  }, []);

  return (
    <CanaryContext.Provider value={{
      threatLevel,
      lastDetection,
      lastScanTime,
      todayCount,
      tier2Active,
      overlayAvailable,
      defenderEnabled,
      callState,
      callStateLabel,
      initialised,
      enableTier2,
      checkOverlayPermission,
      toggleDefender,
      refreshDb,
    }}>
      {children}
    </CanaryContext.Provider>
  );
};
