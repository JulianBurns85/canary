/**
 * cell-monitor-plugin.js — Expo config plugin v3.0
 * Adds all permissions including SYSTEM_ALERT_WINDOW for overlay.
 */

const { withAndroidManifest, withAppBuildGradle } = require('@expo/config-plugins');

const PERMISSIONS = [
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.READ_PHONE_STATE',
  'android.permission.READ_LOGS',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  // Overlay permission — required for call screen indicator
  'android.permission.SYSTEM_ALERT_WINDOW',
];

const withCellMonitorPermissions = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    if (!manifest.manifest['uses-permission']) {
      manifest.manifest['uses-permission'] = [];
    }

    const existing = new Set(
      manifest.manifest['uses-permission'].map((p) => p.$['android:name'])
    );

    for (const perm of PERMISSIONS) {
      if (!existing.has(perm)) {
        manifest.manifest['uses-permission'].push({
          $: { 'android:name': perm },
        });
      }
    }

    // Ensure application element exists
    const app = manifest.manifest.application[0];

    // Foreground service for background scanning
    if (!app.service) app.service = [];
    const svcNames = app.service.map((s) => s.$?.['android:name']);

    if (!svcNames.includes('expo.modules.cellmonitor.CellMonitorForegroundService')) {
      app.service.push({
        $: {
          'android:name': 'expo.modules.cellmonitor.CellMonitorForegroundService',
          'android:foregroundServiceType': 'location',
          'android:exported': 'false',
        },
      });
    }

    return config;
  });
};

const withCellMonitorGradle = (config) => {
  return withAppBuildGradle(config, (config) => {
    const gradle = config.modResults.contents;
    const dep = "implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'";

    if (!gradle.includes('kotlinx-coroutines-android')) {
      config.modResults.contents = gradle.replace(
        /dependencies\s*{/,
        `dependencies {\n    ${dep}`
      );
    }

    return config;
  });
};

module.exports = (config) => {
  config = withCellMonitorPermissions(config);
  config = withCellMonitorGradle(config);
  return config;
};
