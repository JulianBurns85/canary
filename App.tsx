/**
 * App.tsx — Canary v3.0
 * Custom tab navigator — no react-navigation, no react-native-screens.
 * Pure React Native. Works with any RN version.
 */

import React, { useState } from 'react';
import {
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';

import { CanaryProvider } from './src/context/CanaryContext';
import HomeScreen     from './src/screens/HomeScreen';
import ScanScreen     from './src/screens/ScanScreen';
import HistoryScreen  from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AboutScreen    from './src/screens/AboutScreen';

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { name: 'Home',     label: 'STATUS',   icon: '◉', Screen: HomeScreen },
  { name: 'Scan',     label: 'SCAN',     icon: '⊙', Screen: ScanScreen },
  { name: 'History',  label: 'HISTORY',  icon: '☰', Screen: HistoryScreen },
  { name: 'Settings', label: 'SETTINGS', icon: '⚙', Screen: SettingsScreen },
  { name: 'About',    label: 'ABOUT',    icon: 'ⓘ', Screen: AboutScreen },
] as const;

type TabIndex = 0 | 1 | 2 | 3 | 4;

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState<TabIndex>(0);
  const { Screen, label } = TABS[activeTab];

  return (
    <CanaryProvider>
      <SafeAreaView style={styles.root}>
        <ExpoStatusBar style="light" backgroundColor="#0A0A0A" />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>CANARY</Text>
          <Text style={styles.headerSub}>{label}</Text>
        </View>

        {/* Screen content */}
        <View style={styles.content}>
          <Screen />
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {TABS.map((tab, index) => {
            const active = index === activeTab;
            return (
              <TouchableOpacity
                key={tab.name}
                style={styles.tab}
                onPress={() => setActiveTab(index as TabIndex)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabIcon, active && styles.tabIconActive]}>
                  {tab.icon}
                </Text>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {tab.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>
    </CanaryProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const STATUS_BAR_HEIGHT =
  Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 0;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    paddingTop: STATUS_BAR_HEIGHT,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    backgroundColor: '#0D0D0D',
  },
  headerTitle: {
    color: '#00D68F',
    fontSize: 16,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 4,
  },
  headerSub: {
    color: '#444',
    fontSize: 11,
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  content: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0D0D0D',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    paddingBottom: Platform.OS === 'ios' ? 20 : 4,
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  tabIcon: {
    fontSize: 18,
    color: '#444',
  },
  tabIconActive: {
    color: '#00D68F',
  },
  tabLabel: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#444',
  },
  tabLabelActive: {
    color: '#00D68F',
  },
});
