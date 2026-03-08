/**
 * Minimal OTA example: shows stored version and basic actions.
 * Extend with full check/download/reload UI in Phase 7.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getStoredVersion,
  checkForUpdate,
  getRollbackHistory,
  rollbackToPreviousBundle,
  reloadApp,
  type RollbackRecord,
} from 'react-native-nitro-update';

const VERSION_CHECK_URL = 'https://example.com/version.txt';

function App() {
  const [storedVersion, setStoredVersion] = useState<string | null>(() =>
    getStoredVersion()
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<RollbackRecord[]>([]);

  const refreshVersion = useCallback(() => {
    setStoredVersion(getStoredVersion())
  }, []);

  const handleCheck = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const hasUpdate = await checkForUpdate(VERSION_CHECK_URL)
      setMessage(hasUpdate ? 'Update available' : 'No update')
    } catch (e) {
      setMessage(`Check failed: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, []);

  const handleHistory = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const h = await getRollbackHistory()
      setHistory(h)
      setMessage(`Rollback history: ${h.length} entries`)
    } catch (e) {
      setMessage(`History failed: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, []);

  const handleRollback = useCallback(async () => {
    setLoading(true)
    setMessage(null)
    try {
      const ok = await rollbackToPreviousBundle()
      if (ok) {
        setMessage('Rolled back; reloading…')
        reloadApp()
      } else {
        setMessage('No previous bundle to roll back to')
      }
    } catch (e) {
      setMessage(`Rollback failed: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nitro OTA Example</Text>
      <Text style={styles.version}>Stored version: {storedVersion ?? 'none'}</Text>

      <TouchableOpacity style={styles.button} onPress={refreshVersion}>
        <Text style={styles.buttonText}>Refresh version</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleCheck}
        disabled={loading}
      >
        <Text style={styles.buttonText}>Check for update</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleHistory}
        disabled={loading}
      >
        <Text style={styles.buttonText}>Rollback history</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.rollback, loading && styles.buttonDisabled]}
        onPress={handleRollback}
        disabled={loading}
      >
        <Text style={styles.buttonText}>Rollback</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator style={styles.loader} />}
      {message != null && <Text style={styles.message}>{message}</Text>}
      {history.length > 0 && (
        <View style={styles.history}>
          <Text style={styles.historyTitle}>Last rollback:</Text>
          <Text style={styles.historyText}>
            {history[history.length - 1]?.fromVersion} →{' '}
            {history[history.length - 1]?.toVersion}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
  },
  version: {
    fontSize: 16,
    marginBottom: 24,
    color: '#333',
  },
  button: {
    backgroundColor: '#0a7ea4',
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  rollback: {
    backgroundColor: '#c53030',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  loader: {
    marginTop: 16,
  },
  message: {
    marginTop: 16,
    fontSize: 14,
    color: '#333',
  },
  history: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  historyTitle: {
    fontWeight: '600',
    marginBottom: 4,
  },
  historyText: {
    fontSize: 14,
  },
})

export default App
