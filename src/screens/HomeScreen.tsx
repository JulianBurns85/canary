/**
 * HomeScreen.tsx — Canary v3 main screen
 *
 * Single status indicator. Everything else is background.
 * No user interaction required for basic operation.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Share,
} from 'react-native';

import { useCanary } from '../context/CanaryContext';
import OnboardingModal, { isOnboardingComplete } from '../components/OnboardingModal';
import type { ThreatLevel } from '../services/detectionEngine';

// ─── Colours ─────────────────────────────────────────────────────────────────

const THREAT_COLORS: Record<ThreatLevel, string> = {
  CLEAR:      '#00D68F',
  SUSPICIOUS: '#FFD166',
  HIGH:       '#FF8C42',
  THREAT:     '#EF233C',
};

const THREAT_LABELS: Record<ThreatLevel, string> = {
  CLEAR:      'CLEAR',
  SUSPICIOUS: 'SUSPICIOUS',
  HIGH:       'HIGH RISK',
  THREAT:     'THREAT DETECTED',
};

const THREAT_SUB: Record<ThreatLevel, string> = {
  CLEAR:      'No rogue infrastructure detected',
  SUSPICIOUS: 'Anomaly observed — monitoring',
  HIGH:       'High-confidence anomaly detected',
  THREAT:     'Confirmed rogue cell — countermeasures active',
};

// ─── Pulse animation ─────────────────────────────────────────────────────────

const PULSE_SPEEDS: Record<ThreatLevel, number> = {
  CLEAR:      2000,
  SUSPICIOUS: 1200,
  HIGH:       700,
  THREAT:     400,
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const {
    threatLevel,
    lastDetection,
    lastScanTime,
    todayCount,
    tier2Active,
    defenderEnabled,
    initialised,
  } = useCanary();

  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    isOnboardingComplete().then(done => {
      if (!done) setShowOnboarding(true);
    });
  }, []);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  // Pulse animation driven by threat level
  useEffect(() => {
    pulseRef.current?.stop();

    const speed = PULSE_SPEEDS[threatLevel];
    const maxScale = threatLevel === 'CLEAR' ? 1.05 : 1.15;

    pulseRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: maxScale,
          duration: speed,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: speed,
          useNativeDriver: true,
        }),
      ])
    );
    pulseRef.current.start();

    return () => pulseRef.current?.stop();
  }, [threatLevel, pulseAnim]);

  const color = THREAT_COLORS[threatLevel];
  const label = THREAT_LABELS[threatLevel];
  const sub = THREAT_SUB[threatLevel];

  const formatTime = (d: Date | null): string => {
    if (!d) return '—';
    return d.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleShare = async () => {
    const lines = [
      `Canary v3 — Status Report`,
      `Time: ${new Date().toISOString()}`,
      `Status: ${label}`,
      `Today's detections: ${todayCount}`,
      `Tier 2 (Shannon): ${tier2Active ? 'Active' : 'Inactive'}`,
      `Defender Mode: ${defenderEnabled ? 'Active' : 'Inactive'}`,
    ];

    if (lastDetection) {
      lines.push(`Last detection:`, `  CID: ${lastDetection.cid ?? '—'}`);
      lines.push(`  eNB: ${lastDetection.enb_id ?? '—'}`);
      lines.push(`  Confidence: ${(lastDetection.confidence * 100).toFixed(0)}%`);
      lines.push(`  Detectors: ${lastDetection.detectors_fired.join(', ')}`);
    }

    await Share.share({ message: lines.join('\n') });
  };

  if (!initialised) {
    return (
      <>
        <View style={styles.container}>
          <Text style={styles.initText}>Initialising…</Text>
        </View>
        <OnboardingModal visible={showOnboarding} onDone={() => setShowOnboarding(false)} />
      </>
    );
  }

  if (false) {
    return (
      <View style={styles.container}>
        <Text style={styles.initText}>Initialising…</Text>
      </View>
    );
  }

  return (
    <>
    <View style={styles.container}>

      {/* Main status indicator */}
      <View style={styles.indicatorWrapper}>
        <Animated.View
          style={[
            styles.pulseRing,
            { borderColor: color, transform: [{ scale: pulseAnim }] },
          ]}
        />
        <View style={[styles.statusCircle, { backgroundColor: color + '22', borderColor: color }]}>
          <Text style={[styles.statusLabel, { color }]}>{label}</Text>
        </View>
      </View>

      {/* Sub-label */}
      <Text style={styles.subLabel}>{sub}</Text>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{todayCount}</Text>
          <Text style={styles.statKey}>today</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{formatTime(lastScanTime)}</Text>
          <Text style={styles.statKey}>last scan</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: tier2Active ? '#00D68F' : '#666' }]}>
            {tier2Active ? 'T1+T2' : 'T1'}
          </Text>
          <Text style={styles.statKey}>tier</Text>
        </View>
      </View>

      {/* Last detection detail */}
      {lastDetection && lastDetection.threat_level !== 'CLEAR' && (
        <View style={styles.detailBox}>
          <Text style={styles.detailTitle}>Last Detection</Text>
          <Text style={styles.detailLine}>
            CID: {lastDetection.cid ?? '—'}{'  '}
            eNB: {lastDetection.enb_id ?? '—'}
          </Text>
          <Text style={styles.detailLine}>
            Confidence: {(lastDetection.confidence * 100).toFixed(0)}%{'  '}
            Tier: {lastDetection.tier}
          </Text>
          <Text style={styles.detailLine} numberOfLines={1}>
            {lastDetection.detectors_fired.join(' · ')}
          </Text>
        </View>
      )}

      {/* Defender badge */}
      {defenderEnabled && (
        <View style={styles.defenderBadge}>
          <Text style={styles.defenderText}>⚔ DEFENDER ACTIVE</Text>
        </View>
      )}

      {/* Share button */}
      <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
        <Text style={styles.shareBtnText}>Share Report</Text>
      </TouchableOpacity>

    </View>
    <OnboardingModal visible={showOnboarding} onDone={() => setShowOnboarding(false)} />
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  initText: {
    color: '#666',
    fontSize: 16,
    fontFamily: 'monospace',
  },

  // Indicator
  indicatorWrapper: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pulseRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
  },
  statusCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 2,
    textAlign: 'center',
  },

  // Sub-label
  subLabel: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 32,
    fontFamily: 'monospace',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#161616',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    width: '100%',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#2A2A2A',
  },
  statValue: {
    color: '#E8E8E8',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  statKey: {
    color: '#555',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 4,
  },

  // Detail box
  detailBox: {
    width: '100%',
    backgroundColor: '#161616',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#EF233C',
  },
  detailTitle: {
    color: '#888',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailLine: {
    color: '#CCC',
    fontSize: 13,
    fontFamily: 'monospace',
    marginBottom: 4,
  },

  // Defender badge
  defenderBadge: {
    backgroundColor: '#1A1A2E',
    borderColor: '#4A4AFF',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  defenderText: {
    color: '#8888FF',
    fontSize: 11,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },

  // Share button
  shareBtn: {
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  shareBtnText: {
    color: '#666',
    fontSize: 13,
    fontFamily: 'monospace',
  },
});
