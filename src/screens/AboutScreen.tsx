/**
 * AboutScreen.tsx — Canary v3 about screen
 */

import Constants from 'expo-constants';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

const CASES = [
  { label: 'AFP',   value: '333080 · 333545 · 334105' },
  { label: 'VicPol', value: 'INT26IR3127399' },
  { label: 'ACMA',  value: 'ENQ-1851DVJH04' },
  { label: 'TIO',   value: '2026-03-04898' },
];

const ROGUE_PLATFORMS = [
  { label: 'Device A', value: 'Harris HailStorm II', detail: 'eNB 537942 · TAC 12385 · Telstra mask' },
  { label: 'Device B', value: 'srsRAN/BladeRF 2.0',  detail: 'eNB 32849 · TAC 30336 · Vodafone mask' },
];

const DETECTORS = [
  'ROGUE_CID_CONFIRMED',
  'ROGUE_ENB_CONFIRMED',
  'ROGUE_TAC_CONFIRMED',
  'OPERATOR_SPOOF',
  'RSRP_ANOMALY',
  'RSRQ_ANOMALY',
  'SHANNON_ROGUE_CID',
  'SHANNON_ROGUE_ENB',
  'SHANNON_IMS_SUPPORT_SERVICE',
  'SHANNON_IDENTITY_REQUEST',
];

interface InfoRowProps {
  label: string;
  value: string;
  sub?: string;
}

const InfoRow = ({ label, value, sub }: InfoRowProps) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <View>
      <Text style={styles.infoValue}>{value}</Text>
      {sub && <Text style={styles.infoSub}>{sub}</Text>}
    </View>
  </View>
);

export default function AboutScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* App identity */}
      <View style={styles.hero}>
        <Text style={styles.appName}>CANARY</Text>
        <Text style={styles.version}>v{Constants.expoConfig?.version ?? '3.0.0'} · Atomic Tech</Text>
        <Text style={styles.tagline}>
          IMSI catcher detection for GrapheneOS
        </Text>
      </View>

      {/* Detection tiers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detection Architecture</Text>
        <InfoRow label="Tier 1" value="CellInfo API" sub="Any Android · 30s poll · Instant on install" />
        <InfoRow label="Tier 2" value="Shannon IMS Logcat" sub="Pixel/GrapheneOS · Real-time firmware stream" />
      </View>

      {/* Confirmed rogue platforms */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Confirmed Rogue Platforms</Text>
        {ROGUE_PLATFORMS.map((p) => (
          <InfoRow key={p.label} label={p.label} value={p.value} sub={p.detail} />
        ))}
        <Text style={styles.note}>
          YAICD 5.00/5.00 · Triple-confirmed RF + Shannon IMS + CASTNET
        </Text>
      </View>

      {/* Active detectors */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Detectors ({DETECTORS.length})</Text>
        {DETECTORS.map((d) => (
          <Text key={d} style={styles.detector}>· {d}</Text>
        ))}
      </View>

      {/* Case references */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Regulatory Cases</Text>
        {CASES.map((c) => (
          <InfoRow key={c.label} label={c.label} value={c.value} />
        ))}
      </View>

      {/* Corpus */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Corpus (June 18–20 2026)</Text>
        <InfoRow label="Events"     value="579,013" />
        <InfoRow label="YAICD"      value="5.00 / 5.00" />
        <InfoRow label="Heuristics" value="9 / 10" />
        <InfoRow label="Duration"   value="38h 39m continuous" />
        <InfoRow label="Seal"       value="SHA-256 bd30eb1e · 8,873 files" />
      </View>

      {/* GitHub */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Source</Text>
        <Text style={styles.link}>github.com/JulianBurns85/rayhunter-threat-analyzer</Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  appName: {
    color: '#00D68F',
    fontSize: 32,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 8,
  },
  version: {
    color: '#555',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  tagline: {
    color: '#444',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  section: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    gap: 10,
  },
  sectionTitle: {
    color: '#666',
    fontSize: 11,
    fontFamily: 'monospace',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoLabel: {
    color: '#555',
    fontSize: 11,
    fontFamily: 'monospace',
    width: 64,
    paddingTop: 1,
  },
  infoValue: {
    color: '#CCC',
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  infoSub: {
    color: '#555',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  note: {
    color: '#444',
    fontSize: 11,
    fontFamily: 'monospace',
    fontStyle: 'italic',
  },
  detector: {
    color: '#444',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  link: {
    color: '#4488FF',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
