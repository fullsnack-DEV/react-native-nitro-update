import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  checkForUpdate,
  downloadUpdate,
  confirmBundle,
  getStoredVersion,
  getAppVersion,
  getRollbackHistory,
  rollbackToPreviousBundle,
  markCurrentBundleAsBad,
  reloadApp,
  otaUrls,
  type RollbackRecord,
} from 'react-native-nitro-update';
import { baseUrl } from './ota-config';

const { versionUrl, downloadUrl } = otaUrls(baseUrl);

type OTAStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'downloaded'
  | 'up_to_date'
  | 'error';

const STATUS_LABEL: Record<OTAStatus, string> = {
  idle: 'Waiting…',
  checking: 'Checking for update…',
  downloading: 'Downloading update…',
  downloaded: 'Update ready (restart to load)',
  up_to_date: 'You are on the latest version',
  error: 'Update check failed',
};

function App() {
  const [otaStatus, setOtaStatus] = useState<OTAStatus>('idle');
  const [otaError, setOtaError] = useState<string | null>(null);
  const [storedVersion, setStoredVersion] = useState<string | null>(() =>
    getStoredVersion(),
  );
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugMsg, setDebugMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<RollbackRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const runningRef = useRef(false);

  const refreshVersion = useCallback(() => {
    setStoredVersion(getStoredVersion());
  }, []);

  const runOTACheck = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setOtaError(null);
    setOtaStatus('checking');

    try {
      const hasUpdate = await checkForUpdate(versionUrl);
      if (!hasUpdate) {
        setOtaStatus('up_to_date');
        runningRef.current = false;
        return;
      }

      setOtaStatus('downloading');
      await downloadUpdate(downloadUrl);
      refreshVersion();
      setOtaStatus('downloaded');
    } catch (e) {
      setOtaError((e as Error).message);
      setOtaStatus('error');
    } finally {
      runningRef.current = false;
    }
  }, [refreshVersion]);

  useEffect(() => {
    const current = getStoredVersion();
    if (current) confirmBundle();

    const handle = InteractionManager.runAfterInteractions(() => {
      const timer = setTimeout(runOTACheck, 2000);
      return () => clearTimeout(timer);
    });

    return () => handle.cancel();
  }, [runOTACheck]);

  const handleConfirm = useCallback(() => {
    confirmBundle();
    setDebugMsg('Bundle confirmed.');
  }, []);

  const handleRollback = useCallback(async () => {
    setLoading(true);
    try {
      const ok = await rollbackToPreviousBundle();
      if (ok) {
        if (__DEV__) {
          setDebugMsg('Rolled back. Build Release to test reload.');
          refreshVersion();
        } else {
          setDebugMsg('Rolled back. Restarting…');
          reloadApp();
        }
      } else {
        setDebugMsg('No previous bundle to roll back to.');
      }
    } catch (e) {
      setDebugMsg(`Rollback failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [refreshVersion]);

  const handleMarkBad = useCallback(async () => {
    setLoading(true);
    try {
      await markCurrentBundleAsBad('marked_bad_by_user');
      if (__DEV__) {
        setDebugMsg('Bundle marked bad + rolled back.');
        refreshVersion();
      } else {
        setDebugMsg('Bundle marked bad. Restarting…');
        reloadApp();
      }
    } catch (e) {
      setDebugMsg(`Mark bad failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [refreshVersion]);

  const handleHistory = useCallback(async () => {
    setLoading(true);
    try {
      const h = await getRollbackHistory();
      setHistory(h);
      setDebugMsg(
        h.length > 0 ? `${h.length} rollback entries` : 'No rollback history.',
      );
    } catch (e) {
      setDebugMsg(`History: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const isBusy =
    otaStatus === 'checking' || otaStatus === 'downloading' || loading;

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>My App</Text>
        <Text style={styles.buildLabel}>App version {getAppVersion()}</Text>
        {storedVersion != null && (
          <Text style={styles.otaLabel}>OTA bundle: {storedVersion}</Text>
        )}
      </View>

      <View style={[styles.banner, bannerColor(otaStatus)]}>
        {isBusy && (
          <ActivityIndicator
            color="#fff"
            size="small"
            style={styles.bannerSpinner}
          />
        )}
        <View style={styles.bannerBody}>
          <Text style={styles.bannerText}>{STATUS_LABEL[otaStatus]}</Text>
          {otaError != null && (
            <Text style={styles.bannerErrorText}>{otaError}</Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.contentText}>
          OTA is configured via ota-config.js (set by npm run setupOTA).
        </Text>

        <Btn label="Check for update" onPress={runOTACheck} disabled={isBusy} />

        {otaStatus === 'downloaded' && (
          <Btn
            label="Restart to load update"
            onPress={() => reloadApp()}
            bg="#15803d"
          />
        )}

        <TouchableOpacity
          style={styles.debugToggle}
          onPress={() => setDebugOpen(v => !v)}
        >
          <Text style={styles.debugToggleText}>
            {debugOpen ? 'Hide' : 'Show'} Debug Panel
          </Text>
        </TouchableOpacity>

        {debugOpen && (
          <View style={styles.debugPanel}>
            <Btn
              label="Confirm bundle"
              onPress={handleConfirm}
              disabled={isBusy}
            />
            <Btn
              label="Rollback to previous bundle"
              onPress={handleRollback}
              disabled={isBusy}
              bg="#b91c1c"
            />
            <Btn
              label="Mark current bundle as bad"
              onPress={handleMarkBad}
              disabled={isBusy}
              bg="#92400e"
            />
            <Btn
              label="View rollback history"
              onPress={handleHistory}
              disabled={isBusy}
            />

            {debugMsg != null && (
              <Text style={styles.debugMsg}>{debugMsg}</Text>
            )}

            {history.length > 0 && (
              <View style={styles.historyBox}>
                <Text style={styles.historyTitle}>Rollback history</Text>
                {history.map((record, i) => (
                  <Text key={i} style={styles.historyText}>
                    {record.fromVersion} → {record.toVersion} ({record.reason})
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const Btn = React.memo(function Btn({
  label,
  onPress,
  disabled,
  bg,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  bg?: string;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        disabled && styles.buttonDisabled,
        bg ? { backgroundColor: bg } : undefined,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
});

function bannerColor(status: OTAStatus) {
  switch (status) {
    case 'checking':
    case 'downloading':
      return styles.bannerActive;
    case 'downloaded':
      return styles.bannerGreen;
    case 'error':
      return styles.bannerRed;
    default:
      return undefined;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'green' },

  hero: {
    paddingTop: 64,
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: '#0a7ea4',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#fff' },
  buildLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  otaLabel: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#6b7280',
  },
  bannerActive: { backgroundColor: '#0369a1' },
  bannerGreen: { backgroundColor: '#15803d' },
  bannerRed: { backgroundColor: '#b91c1c' },
  bannerSpinner: { marginRight: 8 },
  bannerBody: { flex: 1 },
  bannerText: { color: '#fff', fontSize: 14 },
  bannerErrorText: { color: '#fca5a5', fontSize: 12, marginTop: 2 },

  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  contentText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
  },

  button: {
    backgroundColor: '#374151',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 12,
    minWidth: 260,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '500' },

  debugToggle: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  debugToggleText: { fontSize: 13, color: '#0a7ea4', fontWeight: '500' },

  debugPanel: { width: '100%', paddingTop: 8 },
  debugMsg: { marginTop: 8, fontSize: 13, color: '#333', textAlign: 'center' },

  historyBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  historyTitle: { fontWeight: '600', marginBottom: 4, fontSize: 13 },
  historyText: { fontSize: 13, color: '#555', marginBottom: 2 },
});

export default App;
