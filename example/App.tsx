import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
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
  getRollbackHistory,
  rollbackToPreviousBundle,
  reloadApp,
  githubOTA,
  type RollbackRecord,
} from 'react-native-nitro-update';

const { versionUrl: VERSION_CHECK_URL, downloadUrl: DOWNLOAD_URL } = githubOTA({
  githubUrl: 'https://github.com/fullsnack-DEV/Testing-OTA-builds-via-release',
  otaVersionPath: 'version.txt',
  bundlePath: 'bundle.zip',
  useReleases: true,
})

const BUILD_LABEL = '1.0.7'

type OTAStatus = 'idle' | 'checking' | 'downloading' | 'downloaded' | 'up_to_date' | 'error'

const STATUS_LABEL: Record<OTAStatus, string> = {
  idle: 'Waiting…',
  checking: 'Checking for update…',
  downloading: 'Downloading update…',
  downloaded: 'Update ready (loads on next launch)',
  up_to_date: 'You are on the latest version',
  error: 'Update check failed',
}

function App() {
  const [otaStatus, setOtaStatus] = useState<OTAStatus>('idle')
  const [otaError, setOtaError] = useState<string | null>(null)
  const [storedVersion, setStoredVersion] = useState<string | null>(() => getStoredVersion())
  const [debugOpen, setDebugOpen] = useState(false)
  const [debugMsg, setDebugMsg] = useState<string | null>(null)
  const [history, setHistory] = useState<RollbackRecord[]>([])
  const [loading, setLoading] = useState(false)
  const runningRef = useRef(false)

  const refreshVersion = useCallback(() => {
    setStoredVersion(getStoredVersion())
  }, [])

  const runOTACheck = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    setOtaError(null)
    setOtaStatus('checking')

    try {
      const hasUpdate = await checkForUpdate(VERSION_CHECK_URL)
      if (!hasUpdate) {
        setOtaStatus('up_to_date')
        runningRef.current = false
        return
      }

      setOtaStatus('downloading')
      await downloadUpdate(DOWNLOAD_URL)
      refreshVersion()
      setOtaStatus('downloaded')
    } catch (e) {
      setOtaError((e as Error).message)
      setOtaStatus('error')
    } finally {
      runningRef.current = false
    }
  }, [refreshVersion])

  // Auto-confirm the current bundle on mount so the crash guard is satisfied.
  // Then wait for interactions to settle before silently checking for updates.
  useEffect(() => {
    const current = getStoredVersion()
    if (current) confirmBundle()

    const handle = InteractionManager.runAfterInteractions(() => {
      const timer = setTimeout(runOTACheck, 2000)
      return () => clearTimeout(timer)
    })

    return () => handle.cancel()
  }, [runOTACheck])

  const toggleDebug = useCallback(() => setDebugOpen((v) => !v), [])

  const handleConfirm = useCallback(() => {
    confirmBundle()
    setDebugMsg('Bundle confirmed.')
  }, [])

  const handleHistory = useCallback(async () => {
    setLoading(true)
    try {
      const h = await getRollbackHistory()
      setHistory(h)
      setDebugMsg(`${h.length} rollback entries`)
    } catch (e) {
      setDebugMsg(`History: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRollback = useCallback(async () => {
    setLoading(true)
    try {
      const ok = await rollbackToPreviousBundle()
      if (ok) {
        if (__DEV__) {
          setDebugMsg('Rolled back. Build Release to test reload.')
          setLoading(false)
          refreshVersion()
        } else {
          setDebugMsg('Rolled back. Restarting…')
          reloadApp()
        }
      } else {
        setDebugMsg('No previous bundle.')
        setLoading(false)
      }
    } catch (e) {
      setDebugMsg(`Rollback: ${(e as Error).message}`)
      setLoading(false)
    }
  }, [refreshVersion])

  const isBusy = otaStatus === 'checking' || otaStatus === 'downloading' || loading

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>My App</Text>
        <Text style={styles.buildLabel}>Build {BUILD_LABEL}</Text>
        {storedVersion != null && (
          <Text style={styles.otaLabel}>OTA: {storedVersion}</Text>
        )}
      </View>

      <View style={[styles.banner, bannerColor(otaStatus)]}>
        {isBusy && <ActivityIndicator color="#fff" size="small" style={styles.bannerSpinner} />}
        <View style={styles.bannerBody}>
          <Text style={styles.bannerText}>{STATUS_LABEL[otaStatus]}</Text>
          {otaError != null && <Text style={styles.bannerErrorText}>{otaError}</Text>}
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.contentText}>
          OTA updates run automatically.{'\n'}No buttons needed for your users.
        </Text>
      </View>

      <TouchableOpacity style={styles.debugToggle} onPress={toggleDebug}>
        <Text style={styles.debugToggleText}>
          {debugOpen ? 'Hide' : 'Show'} Debug Panel
        </Text>
      </TouchableOpacity>

      {debugOpen && (
        <View style={styles.debugPanel}>
          <Btn label="Check now" onPress={runOTACheck} disabled={isBusy} />
          <Btn label="Confirm bundle" onPress={handleConfirm} disabled={isBusy} />
          <Btn label="Rollback history" onPress={handleHistory} disabled={isBusy} />
          <Btn label="Rollback" onPress={handleRollback} disabled={isBusy} bg="#b91c1c" />

          {debugMsg != null && <Text style={styles.debugMsg}>{debugMsg}</Text>}
          {history.length > 0 && (
            <View style={styles.historyBox}>
              <Text style={styles.historyTitle}>Last rollback:</Text>
              <Text style={styles.historyText}>
                {history[history.length - 1]?.fromVersion} →{' '}
                {history[history.length - 1]?.toVersion}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

const Btn = React.memo(function Btn({
  label,
  onPress,
  disabled,
  bg,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  bg?: string
}) {
  return (
    <TouchableOpacity
      style={[styles.debugBtn, disabled && styles.debugBtnOff, bg ? { backgroundColor: bg } : undefined]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.debugBtnText}>{label}</Text>
    </TouchableOpacity>
  )
})

function bannerColor(status: OTAStatus) {
  switch (status) {
    case 'checking':
    case 'downloading':
      return styles.bannerActive
    case 'downloaded':
      return styles.bannerGreen
    case 'error':
      return styles.bannerRed
    default:
      return undefined
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'green' },

  hero: { paddingTop: 64, paddingHorizontal: 24, paddingBottom: 16, backgroundColor: '#0a7ea4' },
  title: { fontSize: 28, fontWeight: '700', color: '#fff' },
  buildLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  otaLabel: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 },

  banner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#6b7280' },
  bannerActive: { backgroundColor: '#0369a1' },
  bannerGreen: { backgroundColor: '#15803d' },
  bannerRed: { backgroundColor: '#b91c1c' },
  bannerSpinner: { marginRight: 8 },
  bannerBody: { flex: 1 },
  bannerText: { color: '#fff', fontSize: 14 },
  bannerErrorText: { color: '#fca5a5', fontSize: 12, marginTop: 2 },

  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  contentText: { fontSize: 16, textAlign: 'center', color: '#555', lineHeight: 24 },

  debugToggle: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 20, marginBottom: 8 },
  debugToggleText: { fontSize: 13, color: '#0a7ea4', fontWeight: '500' },

  debugPanel: { paddingHorizontal: 24, paddingBottom: 40 },
  debugBtn: { backgroundColor: '#374151', padding: 12, borderRadius: 8, marginBottom: 8 },
  debugBtnOff: { opacity: 0.5 },
  debugBtnText: { color: '#fff', fontSize: 14, textAlign: 'center' },
  debugMsg: { marginTop: 8, fontSize: 13, color: '#333' },

  historyBox: { marginTop: 8, padding: 10, backgroundColor: '#e5e7eb', borderRadius: 8 },
  historyTitle: { fontWeight: '600', marginBottom: 2, fontSize: 13 },
  historyText: { fontSize: 13 },
})

export default App
