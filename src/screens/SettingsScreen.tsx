/**
 * SettingsScreen.tsx — Canary v3.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Clipboard,
  Keyboard,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useCanary } from '../context/CanaryContext';
import {
  getCustomPiUrl,
  setCustomPiUrl,
  testPiConnection,
  getAdbStatus,
} from '../services/castnetApi';

const ADB_COMMAND =
  'adb shell pm grant com.atomictech.canary android.permission.READ_LOGS';

export default function SettingsScreen() {
  const {
    tier2Active,
    overlayAvailable,
    defenderEnabled,
    enableTier2,
    checkOverlayPermission,
    toggleDefender,
    refreshDb,
  } = useCanary();

  const [copied,          setCopied]          = useState(false);
  const [refreshing,      setRefreshing]      = useState(false);
  const [tier2Attempting, setTier2Attempting] = useState(false);
  const [tier2Error,      setTier2Error]      = useState(false);

  // Pi URL config
  const [piUrlDraft,  setPiUrlDraft]  = useState('');
  const [piUrlSaved,  setPiUrlSaved]  = useState('');
  const [piSaving,    setPiSaving]    = useState(false);
  const [piTesting,   setPiTesting]   = useState(false);
  const [adbStatus,   setAdbStatus]  = useState('idle');
  const [adbDevices,  setAdbDevices] = useState([]);
  const [adbChecking, setAdbChecking] = useState(false);
  const [piStatus,    setPiStatus]    = useState<'idle' | 'ok' | 'fail'>('idle');
  const [piStatusUrl, setPiStatusUrl] = useState('');

  useEffect(() => {
    getCustomPiUrl().then(url => {
      if (url) {
        setPiUrlDraft(url);
        setPiUrlSaved(url);
      }
    });
    // Auto-check Pi and ADB status on mount
    testPiConnection().then(url => {
      if (url) { setPiStatus('ok'); setPiStatusUrl(url); }
      else { setPiStatus('fail'); }
    });
    getAdbStatus().then(result => {
      if (result?.connected) { setAdbStatus('ok'); setAdbDevices(result.devices); }
      else { setAdbStatus('fail'); }
    });
  }, []);

  const handleSavePiUrl = useCallback(async () => {
    Keyboard.dismiss();
    setPiSaving(true);
    setPiStatus('idle');
    await setCustomPiUrl(piUrlDraft);
    setPiUrlSaved(piUrlDraft.trim());
    setPiSaving(false);
  }, [piUrlDraft]);

  const handleTestPi = useCallback(async () => {
    setPiTesting(true);
    setPiStatus('idle');
    const url = await testPiConnection();
    if (url) {
      setPiStatus('ok');
      setPiStatusUrl(url);
    } else {
      setPiStatus('fail');
      setPiStatusUrl('');
    }
    setPiTesting(false);
  }, []);

  const handleClearPiUrl = useCallback(async () => {
    await setCustomPiUrl('');
    setPiUrlDraft('');
    setPiUrlSaved('');
    setPiStatus('idle');
  }, []);

  const handleCheckAdb = useCallback(async () => {
    setAdbChecking(true);
    setAdbStatus('idle');
    const result = await getAdbStatus();
    if (result && result.connected) {
      setAdbStatus('ok');
      setAdbDevices(result.devices);
    } else {
      setAdbStatus('fail');
      setAdbDevices([]);
    }
    setAdbChecking(false);
  }, []);

  const handleCopy = useCallback(() => {
    Clipboard.setString(ADB_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleTier2Activate = useCallback(async () => {
    setTier2Attempting(true);
    setTier2Error(false);
    const ok = await enableTier2();
    if (!ok) setTier2Error(true);
    setTier2Attempting(false);
  }, [enableTier2]);

  const handleRefreshDb = useCallback(async () => {
    setRefreshing(true);
    await refreshDb();
    setRefreshing(false);
  }, [refreshDb]);

  const handleOpenOverlaySettings = useCallback(async () => {
    try {
      await Linking.openURL(
        'android.settings.action.MANAGE_OVERLAY_PERMISSION?package=com.atomictech.canary'
      );
    } catch {
      await Linking.openSettings();
    }
  }, []);

  const handleCheckOverlay = useCallback(async () => {
    await checkOverlayPermission();
  }, [checkOverlayPermission]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Call Overlay ─────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Call Overlay</Text>
          <View style={[styles.dot, { backgroundColor: overlayAvailable ? '#00D68F' : '#444' }]} />
        </View>
        <Text style={styles.desc}>
          When your phone rings, Canary immediately scans the cell environment and
          displays a threat indicator over the incoming call screen.
        </Text>
        <Text style={styles.desc}>
          Green = safe to answer. Red = rogue tower active, with options to
          defend after the call or immediately.
        </Text>

        {!overlayAvailable ? (
          <>
            <View style={styles.stepBox}>
              <Text style={styles.stepNum}>1</Text>
              <Text style={styles.stepText}>
                Tap <Text style={styles.bold}>Open Permission Settings</Text> below
              </Text>
            </View>
            <View style={styles.stepBox}>
              <Text style={styles.stepNum}>2</Text>
              <Text style={styles.stepText}>
                Find <Text style={styles.bold}>Canary</Text> and enable{ ' '}
                <Text style={styles.bold}>Allow display over other apps</Text>
              </Text>
            </View>
            <View style={styles.stepBox}>
              <Text style={styles.stepNum}>3</Text>
              <Text style={styles.stepText}>
                Return here and tap <Text style={styles.bold}>Check Permission</Text>
              </Text>
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleOpenOverlaySettings}>
                <Text style={styles.primaryBtnText}>Open Permission Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={handleCheckOverlay}>
                <Text style={styles.secondaryBtnText}>Check Permission</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.activeBox}>
            <Text style={styles.activeText}>✓ Overlay active — call screen indicator enabled</Text>
          </View>
        )}
      </View>

      {/* ── Tier 2 Shannon ────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Shannon Baseband (Tier 2)</Text>
          <View style={[styles.dot, { backgroundColor: tier2Active ? '#00D68F' : '#444' }]} />
        </View>
        <Text style={styles.desc}>
          Streams real-time baseband logs from the Samsung Shannon IMS service.
          Detects attacks the instant they hit firmware.
        </Text>
        <Text style={styles.desc}>
          One-time ADB command. Run on your PC with Pixel connected via USB.
        </Text>

        {!tier2Active ? (
          <>
            <View style={styles.commandBox}>
              <Text style={styles.commandText} selectable>{ADBSCOMMAND}</Text>
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={handleCopy}>
                <Text style={styles.secondaryBtnText}>
                  {copied ? '✓ Copied' : 'Copy Command'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, tier2Attempting && styles.disabled]}
                onPress={handleTier2Activate}
                disabled={tier2Attempting}
              >
                <Text style={styles.primaryBtnText}>
                  {tier2Attempting ? 'Checking…' : 'Activate Tier 2'}
                </Text>
              </TouchableOpacity>
            </View>
            {tier2Error && (
              <Text style={styles.errorText}>
                READ_LOGS not granted yet. Run the ADB command first, then tap Activate.
              </Text>
            )}
          </>
        ) : (
          <View style={styles.activeBox}>
            <Text style={styles.activeText}>✓ Tier 2 active — Shannon stream running</Text>
          </View>
        )}
      </View>

      {/* ── Defender Mode ───────────────────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Defender Mode</Text>
          <Switch
            value={defenderEnabled}
            onValueChange={toggleDefender}
            trackColor={{ false: '#2A2A2A', true: '#4A4AGF44' }}
            thumbColor={defenderEnabled ? '#8888FF' : '#555'}
          />
        </View>
        <Text style={styles.desc}>
          On confirmed threat (≥80% confidence), POSTs to CASTNET Pi to trigger
          countermeasure via ADB. During calls, defender fires automatically after
          you hang up. 5-minute global cooldown between countermeasures.
        </Text>
      </View>

      {/* ── Rogue Database ───────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rogue Database</Text>
        <Text style={styles.desc}>
          Local baseline always available offline. Remote updates from CASTNET Pi
          every 6 hours, merged into baseline.
        </Text>
        <TouchableOpacity
          style={[styles.secondaryBtn, { alignSelf: 'stretch' }, refreshing && styles.disabled]}
          onPress={handleRefreshDb}
          disabled={refreshing}
        >
          <Text style={styles.secondaryBtnText}>
            {refreshing ? 'Refreshing…' : 'Force Refresh from Pi'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── CASTNET Pi Connection ────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CASTNET Pi Connection</Text>
        <Text style={styles.desc}>
          Custom Pi URL is tried first. Leave blank to use defaults (Tailscale +
          LAN fallback).
        </Text>

        <TextInput
          style={styles.urlInput}
          value={piUrlDraft}
          onChangeText={setPiUrlDraft}
          placeholder="http://192.168.x.x:5000"
          placeholderTextColor="#444"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.primaryBtn, piSaving && styles.disabled]}
            onPress={handleSavePiUrl}
            disabled={piSaving}
          >
            <Text style={styles.primaryBtnText}>
              {piSaving ? 'Saving…' : 'Save URL'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryBtn, piTesting && styles.disabled]}
            onPress={handleTestPi}
            disabled={piTesting}
          >
            {piTesting
              ? <ActivityIndicator size="small" color="#AAA" />
              : <Text style={styles.secondaryBtnText}>Test Connection</Text>
            }
          </TouchableOpacity>
        </View>

        {piUrlSaved !== '' && (
          <TouchableOpacity onPress={handleClearPiUrl}>
            <Text style={styles.clearText}>Clear custom URL</Text>
          </TouchableOpacity>
        )}

        {piStatus === 'ok' && (
          <View style={styles.activeBox}>
            <Text style={styles.activeText}>✓ Connected — {piStatusUrl}</Text>
          </View>
        )}
        {piStatus === 'fail' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              No Pi reachable. Check URL, network, and that castnet_api.py is running.
            </Text>
          </View>
        )}

        <Text style={styles.endpoint}>Default 1  100.68.146.48:5000 (Tailscale)</Text>
        <Text style={styles.endpoint}>Default 2  192.168.1.239:5000 (Local)</Text>
      </View>

      {/* ── ADB Connection Status ─────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ADB Connection</Text>
        <Text style={styles.desc}>
          Pi must maintain an ADB connection to this device to trigger countermeasures.
          Check that the Pi can reach the Pixel.
        </Text>
        <TouchableOpacity
          style={[styles.secondaryBtn, { alignSelf: 'stretch' }, adbChecking && styles.disabled]}
          onPress={handleCheckAdb}
          disabled={adbChecking}
        >
          {adbChecking
            ? <ActivityIndicator size="small" color="#AAA" />
            : <Text style={styles.secondaryBtnText}>Check ADB Status</Text>
          }
        </TouchableOpacity>
        {adbStatus === 'ok' && (
          <View style={styles.activeBox}>
            <Text style={styles.activeText}>✓ Pi connected — {adbDevices.join(', ')}</Text>
          </View>
        )}
        {adbStatus === 'fail' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              Pi cannot reach this device via ADB. Run: adb connect 192.168.x.x:5555 on the Pi, or check that wireless debugging is enabled.
            </Text>
          </View>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  content:   { padding: 16, gap: 12 },

  section: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E1E1E',
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#CCC',
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },

  desc: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },

  stepBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepNum: {
    color: '#00D68F',
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '700',
    width: 16,
  },
  stepText: {
    color: '#888',
    fontSize: 12,
    fontFamily: 'monospace',
    flex: 1,
    lineHeight: 18,
  },
  bold: { color: '#CCC', fontWeight: '600' },

  buttonRow: { flexDirection: 'row', gap: 8 },

  primaryBtn: {
    flex: 1,
    backgroundColor: '#001A33',
    borderColor: '#004499',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#4488FF',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#AAA',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  disabled: { opacity: 0.5 },

  commandBox: {
    backgroundColor: '#0A0A0A',
    borderColor: '#2A2A2A',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  commandText: {
    color: '#00D68F',
    fontSize: 11,
    fontFamily: 'monospace',
  },

  urlInput: {
    backgroundColor: '#0A0A0A',
    borderColor: '#2A2A2A',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    color: '#00D68F',
    fontSize: 12,
    fontFamily: 'monospace',
  },

  clearText: {
    color: '#555',
    fontSize: 11,
    fontFamily: 'monospace',
    textDecorationLine: 'underline',
  },

  activeBox: {
    backgroundColor: '#001A0D',
    borderColor: '#00D68F33',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  activeText: {
    color: '#00D68F',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  errorBox: {
    backgroundColor: '#1A0005',
    borderColor: '#EF233C33',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: '#EF233C',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  endpoint: {
    color: '#333',
    fontSize: 11,
    fontFamily: 'monospace',
  },
});
