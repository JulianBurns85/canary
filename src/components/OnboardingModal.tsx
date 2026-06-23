/**
 * OnboardingModal.tsx — Canary v3 first-run setup
 *
 * 4 steps: Welcome → Pi Connection → ADB Setup → Done
 * Shown once on first launch, dismissed permanently via AsyncStorage.
 */

import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Clipboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setCustomPiUrl, testPiConnection } from '../services/castnetApi';

const ONBOARDING_KEY = '@canary/onboarding_complete';

const ADB_COMMAND =
  'adb shell pm grant com.atomictech.canary android.permission.READ_LOGS';

export const markOnboardingComplete = async (): Promise<void> => {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1').catch(() => {});
};

export const isOnboardingComplete = async (): Promise<boolean> => {
  try {
    const v = await AsyncStorage.getItem(ONBOARDING_KEY);
    return v === '1';
  } catch { return false; }
};

interface Props {
  visible: boolean;
  onDone: () => void;
}

export default function OnboardingModal({ visible, onDone }: Props) {
  const [step,        setStep]       = useState(0);
  const [piUrl,       setPiUrl]      = useState('');
  const [piTesting,   setPiTesting]  = useState(false);
  const [piStatus,    setPiStatus]   = useState<'idle' | 'ok' | 'fail'>('idle');
  const [piConnected, setPiConnected] = useState('');
  const [adbCopied,   setAdbCopied]  = useState(false);

  const handleTestPi = useCallback(async () => {
    if (piUrl.trim()) await setCustomPiUrl(piUrl.trim());
    setPiTesting(true);
    setPiStatus('idle');
    const url = await testPiConnection();
    if (url) {
      setPiStatus('ok');
      setPiConnected(url);
    } else {
      setPiStatus('fail');
    }
    setPiTesting(false);
  }, [piUrl]);

  const handleCopyAdb = useCallback(() => {
    Clipboard.setString(ADB_COMMAND);
    setAdbCopied(true);
    setTimeout(() => setAdbCopied(false), 2000);
  }, []);

  const handleDone = useCallback(async () => {
    if (piUrl.trim()) await setCustomPiUrl(piUrl.trim());
    await markOnboardingComplete();
    onDone();
  }, [piUrl, onDone]);

  const STEPS = ['Welcome', 'Pi Setup', 'ADB', 'Ready'];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>

          {/* Progress dots */}
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]}
              />
            ))}
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>

            {/* ── Step 0: Welcome ─────────────────────────────────── */}
            {step === 0 && (
              <View style={styles.stepContent}>
                <Text style={styles.bigTitle}>CANARY</Text>
                <Text style={styles.version}>v3.0.0 · Atomic Tech</Text>
                <Text style={styles.tagline}>IMSI catcher detection for GrapheneOS</Text>

                <View style={styles.divider} />

                <Text style={styles.bodyTitle}>What Canary does</Text>
                <Item icon="📡" text="Monitors LTE cell environment every 30 seconds" />
                <Item icon="🔍" text="Detects rogue base stations using 10 forensic detectors" />
                <Item icon="🛡️" text="Triggers countermeasures via your CASTNET Pi on confirmed threats" />
                <Item icon="📞" text="Shows threat overlay before you answer calls" />

                <View style={styles.divider} />

                <Text style={styles.note}>
                  Canary works immediately with Tier 1 detection (CellInfo API).{'\n'}
                  Tier 2 (Shannon baseband) and Defender Mode require additional setup — covered in the next steps.
                </Text>
              </View>
            )}

            {/* ── Step 1: Pi Setup ────────────────────────────────── */}
            {step === 1 && (
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>CASTNET Pi Setup</Text>
                <Text style={styles.stepDesc}>
                  Canary connects to a CASTNET Pi for rogue database updates and countermeasure triggers.
                  Enter your Pi's IP address below. Leave blank to use the defaults (Tailscale + LAN).
                </Text>

                <Text style={styles.label}>Pi URL (optional)</Text>
                <TextInput
                  style={styles.input}
                  value={piUrl}
                  onChangeText={setPiUrl}
                  placeholder="http://192.168.x.x:5000"
                  placeholderTextColor="#444"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />

                <TouchableOpacity
                  style={[styles.primaryBtn, piTesting && styles.disabled]}
                  onPress={handleTestPi}
                  disabled={piTesting}
                >
                  {piTesting
                    ? <ActivityIndicator size="small" color="#4488FF" />
                    : <Text style={styles.primaryBtnText}>Test Connection</Text>
                  }
                </TouchableOpacity>

                {piStatus === 'ok' && (
                  <View style={styles.successBox}>
                    <Text style={styles.successText}>✓ Connected — {piConnected}</Text>
                  </View>
                )}
                {piStatus === 'fail' && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>
                      No Pi reachable. You can set this later in Settings → CASTNET Pi Connection.
                    </Text>
                  </View>
                )}

                <View style={styles.divider} />
                <Text style={styles.note}>
                  Default endpoints:{'\n'}
                  100.68.146.48:5000 (Tailscale){'\n'}
                  192.168.1.239:5000 (LAN fallback)
                </Text>
              </View>
            )}

            {/* ── Step 2: ADB Setup ───────────────────────────────── */}
            {step === 2 && (
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Shannon Tier 2 Setup</Text>
                <Text style={styles.stepDesc}>
                  Tier 2 streams real-time firmware logs from the Shannon IMS service, detecting attacks
                  the instant they hit baseband. It requires a one-time ADB command run from your PC.
                </Text>

                <View style={styles.stepRow}>
                  <Text style={styles.stepNum}>1</Text>
                  <Text style={styles.stepText}>Connect the Pixel to your PC via USB</Text>
                </View>
                <View style={styles.stepRow}>
                  <Text style={styles.stepNum}>2</Text>
                  <Text style={styles.stepText}>Copy and run this command in PowerShell or Terminal:</Text>
                </View>

                <View style={styles.commandBox}>
                  <Text style={styles.commandText} selectable>{ADB_COMMAND}</Text>
                </View>

                <TouchableOpacity style={styles.secondaryBtn} onPress={handleCopyAdb}>
                  <Text style={styles.secondaryBtnText}>
                    {adbCopied ? '✓ Copied' : 'Copy Command'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.stepRow}>
                  <Text style={styles.stepNum}>3</Text>
                  <Text style={styles.stepText}>
                    Go to Settings → Shannon Baseband and tap <Text style={styles.bold}>Activate Tier 2</Text>
                  </Text>
                </View>

                <View style={styles.divider} />
                <Text style={styles.note}>
                  You can skip this step and complete it later in Settings. Tier 1 (CellInfo API) is active immediately.
                </Text>
              </View>
            )}

            {/* ── Step 3: Done ────────────────────────────────────── */}
            {step === 3 && (
              <View style={styles.stepContent}>
                <Text style={styles.bigTitle}>READY</Text>
                <Text style={styles.tagline}>Canary is now monitoring</Text>

                <View style={styles.divider} />

                <Item icon="✓" text="Tier 1 detection active (CellInfo API, 30s poll)" green />
                <Item icon={piStatus === 'ok' ? '✓' : '○'} text="CASTNET Pi connection" green={piStatus === 'ok'} />
                <Item icon="○" text="Tier 2 — complete ADB setup in Settings" />
                <Item icon="○" text="Call Overlay — grant permission in Settings" />

                <View style={styles.divider} />

                <Text style={styles.note}>
                  Canary runs automatically in the background. You will be notified if a threat is detected.
                  Visit Settings any time to configure Defender Mode, Pi connection, and Tier 2.
                </Text>
              </View>
            )}

          </ScrollView>

          {/* Navigation */}
          <View style={styles.navRow}>
            {step > 0 && (
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)}>
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            {step < STEPS.length - 1 && (
              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(s => s + 1)}>
                <Text style={styles.nextBtnText}>{step === 1 && piStatus === 'idle' ? 'Skip' : 'Next'}</Text>
              </TouchableOpacity>
            )}
            {step === STEPS.length - 1 && (
              <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
                <Text style={styles.doneBtnText}>Start Monitoring</Text>
              </TouchableOpacity>
            )}
          </View>

        </View>
      </View>
    </Modal>
  );
}

function Item({ icon, text, green }: { icon: string; text: string; green?: boolean }) {
  return (
    <View style={styles.item}>
      <Text style={[styles.itemIcon, green && styles.itemIconGreen]}>{icon}</Text>
      <Text style={styles.itemText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000CC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#111',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
    width: '100%',
    maxHeight: '85%',
    padding: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#333',
  },
  dotActive: { backgroundColor: '#00D68F' },
  dotDone:   { backgroundColor: '#00D68F66' },

  stepContent: { paddingBottom: 8 },

  bigTitle: {
    color: '#00D68F',
    fontSize: 32,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 4,
  },
  version: {
    color: '#444',
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginBottom: 4,
  },
  tagline: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginBottom: 16,
  },

  stepTitle: {
    color: '#CCC',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  stepDesc: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
    marginBottom: 16,
  },

  bodyTitle: {
    color: '#888',
    fontSize: 11,
    fontFamily: 'monospace',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  itemIcon: {
    fontSize: 14,
    color: '#444',
    width: 20,
    textAlign: 'center',
  },
  itemIconGreen: { color: '#00D68F' },
  itemText: {
    color: '#888',
    fontSize: 12,
    fontFamily: 'monospace',
    flex: 1,
    lineHeight: 18,
  },

  divider: {
    height: 1,
    backgroundColor: '#1E1E1E',
    marginVertical: 16,
  },
  note: {
    color: '#444',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 17,
  },

  label: {
    color: '#666',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 6,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: '#0A0A0A',
    borderColor: '#2A2A2A',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    color: '#00D68F',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 10,
  },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
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

  commandBox: {
    backgroundColor: '#0A0A0A',
    borderColor: '#2A2A2A',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  commandText: {
    color: '#00D68F',
    fontSize: 11,
    fontFamily: 'monospace',
  },

  primaryBtn: {
    backgroundColor: '#001A33',
    borderColor: '#004499',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 10,
    justifyContent: 'center',
    height: 40,
  },
  primaryBtnText: {
    color: '#4488FF',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  secondaryBtn: {
    backgroundColor: '#1A1A1A',
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  secondaryBtnText: {
    color: '#AAA',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  disabled: { opacity: 0.5 },

  successBox: {
    backgroundColor: '#001A0D',
    borderColor: '#00D68F33',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  successText: {
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
    marginBottom: 10,
  },
  errorText: {
    color: '#EF233C',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 17,
  },

  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
  },
  backBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  backBtnText: {
    color: '#555',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  nextBtn: {
    backgroundColor: '#001A33',
    borderColor: '#004499',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  nextBtnText: {
    color: '#4488FF',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  doneBtn: {
    backgroundColor: '#001A0D',
    borderColor: '#00D68F',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  doneBtnText: {
    color: '#00D68F',
    fontSize: 13,
    fontFamily: 'monospace',
  },
});
