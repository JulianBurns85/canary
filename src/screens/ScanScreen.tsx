/**
 * ScanScreen.tsx - Canary v3 live cell scan view
 *
 * FIX v3: Parse cell bundle format (cell_count/cell_N) not event.cells array.
 *         Auto-poll with safe async/catch wrapping on all native calls.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  addCellInfoListener,
  startMonitoring,
  triggerImmediateScan,
} from 'cell-monitor';
import type { NativeCellInfo } from 'cell-monitor';
import { scoreCellInfo } from '../services/detectionEngine';
import type { ThreatLevel } from '../services/detectionEngine';

const THREAT_COLORS: Record<ThreatLevel, string> = {
  CLEAR:      '#00D68F',
  SUSPICIOUS: '#FFD166',
  HIGH:       '#FF8C42',
  THREAT:     '#EF233C',
};

interface CellDisplay extends NativeCellInfo {
  threat_level: ThreatLevel;
  confidence: number;
  detectors_fired: string[];
}

/**
 * Parse native cell event bundle format:
 *   { cell_count: N, cell_0: {...}, cell_1: {...}, ... }
 * or direct array format:
 *   { cells: [...] }
 */
function parseCellEvent(event: any): NativeCellInfo[] {
  // Direct array format
  if (Array.isArray(event?.cells)) {
    return event.cells as NativeCellInfo[];
  }
  // Bundle format: cell_count + cell_N keys
  const count: number = event?.cell_count ?? 0;
  const cells: NativeCellInfo[] = [];
  for (let i = 0; i < count; i++) {
    const c = event?.[`cell_${i}`];
    if (!c) continue;
    cells.push({
      type:       c.type       ?? 'LTE',
      cid:        c.cid        ?? 0,
      pci:        c.pci        ?? 0,
      tac:        c.tac        ?? 0,
      mcc:        c.mcc        ?? '',
      mnc:        c.mnc        ?? '',
      earfcn:     c.earfcn     ?? 0,
      rsrp:       c.rsrp       ?? -120,
      rsrq:       c.rsrq       ?? -20,
      registered: c.registered ?? false,
      timestamp:  c.timestamp  ?? Date.now(),
    } as NativeCellInfo);
  }
  return cells;
}

export default function ScanScreen() {
  const [cells, setCells] = useState<CellDisplay[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const subRef = useRef<{ remove: () => void } | null>(null);

  // Listener: receives cell data pushed from native layer
  useEffect(() => {
    subRef.current = addCellInfoListener((event) => {
      try {
        const rawCells = parseCellEvent(event);
        const scored = rawCells.map((raw) => {
          const result = scoreCellInfo(raw as any);
          return {
            ...raw,
            threat_level: result.threat_level,
            confidence: result.confidence,
            detectors_fired: result.detectors_fired,
          } as CellDisplay;
        });
        scored.sort((a, b) => b.confidence - a.confidence);
        setCells(scored);
        setLastUpdate(new Date());
        setScanError(null);
      } catch (e: any) {
        console.warn('[ScanScreen] listener error:', e?.message ?? e);
        setScanError(e?.message ?? 'Listener error');
      }
    });

    return () => {
      subRef.current?.remove();
    };
  }, []);

  // Auto-poll: start monitoring on mount, then scan every 30s
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const doScan = async () => {
      try {
        await triggerImmediateScan();
      } catch (e: any) {
        console.warn('[ScanScreen] triggerImmediateScan failed:', e?.message ?? e);
      }
    };

    const init = async () => {
      try {
        await startMonitoring();
      } catch (e: any) {
        console.warn('[ScanScreen] startMonitoring failed:', e?.message ?? e);
        setScanError(e?.message ?? 'Monitor start error');
      }
      intervalId = setInterval(doScan, 30000);
    };

    init();

    return () => {
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, []);

  const renderCell = useCallback(({ item }: { item: CellDisplay }) => {
    const color = THREAT_COLORS[item.threat_level];

    return (
      <View style={[styles.cell, { borderLeftColor: color }]}>
        <View style={styles.cellHeader}>
          <Text style={[styles.cellType, { color }]}>{item.threat_level}</Text>
          {item.registered && (
            <View style={styles.regBadge}>
              <Text style={styles.regText}>REGISTERED</Text>
            </View>
          )}
          <Text style={styles.cellTime}>
            {(item.confidence * 100).toFixed(0)}% confidence
          </Text>
        </View>

        <View style={styles.cellGrid}>
          <View style={styles.cellField}>
            <Text style={styles.fieldKey}>CID</Text>
            <Text style={styles.fieldVal}>{item.cid}</Text>
          </View>
          <View style={styles.cellField}>
            <Text style={styles.fieldKey}>eNB</Text>
            <Text style={styles.fieldVal}>{Math.floor(item.cid / 256)}</Text>
          </View>
          <View style={styles.cellField}>
            <Text style={styles.fieldKey}>TAC</Text>
            <Text style={styles.fieldVal}>{item.tac}</Text>
          </View>
          <View style={styles.cellField}>
            <Text style={styles.fieldKey}>PCI</Text>
            <Text style={styles.fieldVal}>{item.pci}</Text>
          </View>
          <View style={styles.cellField}>
            <Text style={styles.fieldKey}>RSRP</Text>
            <Text style={styles.fieldVal}>{item.rsrp} dBm</Text>
          </View>
          <View style={styles.cellField}>
            <Text style={styles.fieldKey}>RSRQ</Text>
            <Text style={styles.fieldVal}>{item.rsrq} dB</Text>
          </View>
          <View style={styles.cellField}>
            <Text style={styles.fieldKey}>MCC</Text>
            <Text style={styles.fieldVal}>{item.mcc}</Text>
          </View>
          <View style={styles.cellField}>
            <Text style={styles.fieldKey}>MNC</Text>
            <Text style={styles.fieldVal}>{item.mnc}</Text>
          </View>
        </View>

        {item.detectors_fired.length > 0 && (
          <Text style={styles.detectors} numberOfLines={1}>
            {item.detectors_fired.join('  \u00b7  ')}
          </Text>
        )}
      </View>
    );
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Cell Scan</Text>
        <Text style={styles.headerSub}>
          {scanError
            ? `Error: ${scanError}`
            : lastUpdate
            ? `Updated ${lastUpdate.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
            : 'Starting scan\u2026'}
        </Text>
      </View>

      {cells.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {scanError ? 'Scan failed' : 'Awaiting first scan'}
          </Text>
          <Text style={styles.emptySubText}>
            {scanError
              ? scanError
              : 'Cell data updates every 30 seconds automatically'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={cells}
          keyExtractor={(item) => `${item.cid}-${item.tac}`}
          renderItem={renderCell}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  headerTitle: { color: '#CCC', fontSize: 15, fontFamily: 'monospace', fontWeight: '600' },
  headerSub: { color: '#444', fontSize: 11, fontFamily: 'monospace', marginTop: 4 },
  list: { padding: 12 },
  cell: { backgroundColor: '#111', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#1E1E1E', borderLeftWidth: 3 },
  cellHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cellType: { fontSize: 11, fontFamily: 'monospace', fontWeight: '700', letterSpacing: 0.5 },
  regBadge: { backgroundColor: '#001A33', borderColor: '#004499', borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  regText: { color: '#4488FF', fontSize: 9, fontFamily: 'monospace', fontWeight: '600' },
  cellTime: { color: '#555', fontSize: 11, fontFamily: 'monospace', marginLeft: 'auto' },
  cellGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  cellField: { width: '22%' },
  fieldKey: { color: '#444', fontSize: 9, fontFamily: 'monospace', letterSpacing: 0.5 },
  fieldVal: { color: '#CCC', fontSize: 12, fontFamily: 'monospace', fontWeight: '600' },
  detectors: { color: '#555', fontSize: 10, fontFamily: 'monospace' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { color: '#444', fontSize: 15, fontFamily: 'monospace' },
  emptySubText: { color: '#333', fontSize: 12, fontFamily: 'monospace', textAlign: 'center', paddingHorizontal: 40 },
});
