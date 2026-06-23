/**
 * HistoryScreen.tsx — Canary v3 detection history
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { DetectionResult, ThreatLevel } from '../services/detectionEngine';
import {
  clearDetectionHistory,
  getDetectionHistory,
} from '../services/detectionHistory';

const BADGE_COLORS: Record<ThreatLevel, string> = {
  CLEAR:      '#00D68F',
  SUSPICIOUS: '#FFD166',
  HIGH:       '#FF8C42',
  THREAT:     '#EF233C',
};

const TIER_LABELS: Record<1 | 2, string> = {
  1: 'T1',
  2: 'T2·Shannon',
};

const DETECTOR_LABELS: Record<string, string> = {
  ROGUE_CID_CONFIRMED:        'Known rogue cell ID',
  ROGUE_ENB_CONFIRMED:        'Known rogue tower',
  ROGUE_TAC_CONFIRMED:        'Known rogue tracking area',
  OPERATOR_SPOOF:             'Operator identity spoof',
  RSRP_ANOMALY:               'Abnormal signal strength',
  RSRQ_ANOMALY:               'Abnormal signal quality',
  SHANNON_ROGUE_CID:          'Rogue cell in firmware',
  SHANNON_ROGUE_ENB:          'Rogue tower in firmware',
  SHANNON_IMS_SUPPORT_SERVICE:'IMS service anomaly',
  SHANNON_IDENTITY_REQUEST:   'Identity harvest attempt',
};

const labelDetector = (d: string): string => DETECTOR_LABELS[d] ?? d;

interface DetectionItemProps {
  item: DetectionResult;
}

const DetectionItem = React.memo(({ item }: DetectionItemProps) => {
  const color = BADGE_COLORS[item.threat_level];
  const dt = new Date(item.timestamp);

  return (
    <View style={styles.item}>
      <View style={styles.itemHeader}>
        <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
          <Text style={[styles.badgeText, { color }]}>{item.threat_level}</Text>
        </View>
        <Text style={styles.tier}>{TIER_LABELS[item.tier]}</Text>
        <Text style={styles.time}>
          {dt.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit' })}{'  '}
          {dt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </Text>
      </View>

      <View style={styles.itemBody}>
        <Text style={styles.field}>
          CID <Text style={styles.value}>{item.cid ?? '—'}</Text>
          {'    '}
          eNB <Text style={styles.value}>{item.enb_id ?? '—'}</Text>
          {'    '}
          <Text style={styles.confidence}>
            {(item.confidence * 100).toFixed(0)}%
          </Text>
        </Text>
        {item.tac !== undefined && (
          <Text style={styles.field}>
            TAC <Text style={styles.value}>{item.tac}</Text>
            {item.mcc ? `    MCC ${item.mcc} MNC ${item.mnc ?? '—'}` : ''}
          </Text>
        )}
        <Text style={styles.detectors} numberOfLines={2}>
          {item.detectors_fired.map(labelDetector).join('  ·  ')}
        </Text>
      </View>
    </View>
  );
});

DetectionItem.displayName = 'DetectionItem';

export default function HistoryScreen() {
  const [history, setHistory] = useState<DetectionResult[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await getDetectionHistory(200);
    setHistory(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onClear = useCallback(async () => {
    await clearDetectionHistory();
    setHistory([]);
  }, []);

  const onExport = useCallback(async () => {
    if (history.length === 0) return;
    const lines = [
      'Canary v3 — Detection History Export',
      `Exported: ${new Date().toISOString()}`,
      `Total events: ${history.length}`,
      '',
      ...history.map(d => [
        `[${new Date(d.timestamp).toISOString()}] ${d.threat_level} ${(d.confidence * 100).toFixed(0)}% T${d.tier}`,
        `  CID: ${d.cid ?? '-'}  eNB: ${d.enb_id ?? '-'}  TAC: ${d.tac ?? '-'}  MCC: ${d.mcc ?? '-'}  MNC: ${d.mnc ?? '-'}`,
        `  Detectors: ${d.detectors_fired.map(labelDetector).join(', ')}`,
      ].join('\n')),
    ];
    await Share.share({ message: lines.join('\n') });
  }, [history]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Detection History</Text>
        {history.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <TouchableOpacity onPress={onExport}>
              <Text style={styles.clearBtn}>Export</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClear}>
              <Text style={styles.clearBtn}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {history.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No detections recorded</Text>
          <Text style={styles.emptySubText}>
            Non-clear events are logged here automatically
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <DetectionItem item={item} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#555"
            />
          }
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  headerTitle: {
    color: '#CCC',
    fontSize: 15,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  clearBtn: {
    color: '#555',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  list: {
    padding: 12,
  },
  separator: {
    height: 8,
  },
  item: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tier: {
    color: '#4A9EFF',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  time: {
    color: '#555',
    fontSize: 11,
    fontFamily: 'monospace',
    marginLeft: 'auto',
  },
  itemBody: {
    gap: 4,
  },
  field: {
    color: '#888',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  value: {
    color: '#CCC',
    fontWeight: '600',
  },
  confidence: {
    color: '#FFD166',
    fontWeight: '600',
  },
  detectors: {
    color: '#555',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    color: '#444',
    fontSize: 15,
    fontFamily: 'monospace',
  },
  emptySubText: {
    color: '#333',
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
