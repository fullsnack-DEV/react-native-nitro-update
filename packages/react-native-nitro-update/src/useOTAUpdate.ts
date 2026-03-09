import { useEffect, useRef, useState, useCallback } from 'react'
import { InteractionManager, AppState, type AppStateStatus } from 'react-native'
import {
  checkForUpdate,
  downloadUpdate,
  confirmBundle,
  getStoredVersion,
  reloadApp,
} from './index'

export type OTAStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'downloaded'
  | 'up_to_date'
  | 'error'

export type InstallMode = 'on_next_restart' | 'immediate'

export interface UseOTAUpdateOptions {
  /** URL to check the remote version string (e.g. version.txt) */
  versionUrl: string
  /** URL to download the OTA zip */
  downloadUrl: string
  /**
   * When to apply the downloaded update:
   * - 'on_next_restart' (default): bundle is stored and loaded on next cold start.
   * - 'immediate': calls reloadApp() right after download.
   */
  installMode?: InstallMode
  /**
   * Milliseconds to wait after interactions settle before checking.
   * Keeps the JS thread free during startup animations. Default: 3000
   */
  checkDelayMs?: number
  /** Auto-download when an update is found. Default: true */
  autoDownload?: boolean
  /**
   * Auto-confirm on mount: tells the native layer "this bundle is healthy".
   * Prevents the crash guard from rolling back a working update. Default: true
   */
  autoConfirm?: boolean
  /** Re-check when app returns to foreground. Default: false */
  checkOnForeground?: boolean
}

export interface UseOTAUpdateResult {
  status: OTAStatus
  error: string | null
  storedVersion: string | null
  /** Manually trigger a check + download cycle */
  checkNow: () => void
}

export function useOTAUpdate(options: UseOTAUpdateOptions): UseOTAUpdateResult {
  const {
    versionUrl,
    downloadUrl,
    installMode = 'on_next_restart',
    checkDelayMs = 3000,
    autoDownload = true,
    autoConfirm = true,
    checkOnForeground = false,
  } = options

  const [status, setStatus] = useState<OTAStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [storedVersion, setStoredVersion] = useState<string | null>(() => getStoredVersion())

  const runningRef = useRef(false)

  const runUpdate = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    setError(null)
    setStatus('checking')

    try {
      const hasUpdate = await checkForUpdate(versionUrl)
      if (!hasUpdate) {
        setStatus('up_to_date')
        runningRef.current = false
        return
      }

      if (!autoDownload) {
        setStatus('downloaded')
        runningRef.current = false
        return
      }

      setStatus('downloading')
      await downloadUpdate(downloadUrl)
      setStoredVersion(getStoredVersion())
      setStatus('downloaded')

      if (installMode === 'immediate' && !__DEV__) {
        reloadApp()
        return
      }
    } catch (e) {
      setError((e as Error).message)
      setStatus('error')
    } finally {
      runningRef.current = false
    }
  }, [versionUrl, downloadUrl, autoDownload, installMode])

  useEffect(() => {
    if (autoConfirm) {
      const current = getStoredVersion()
      if (current) confirmBundle()
    }

    const handle = InteractionManager.runAfterInteractions(() => {
      const timer = setTimeout(runUpdate, checkDelayMs)
      return () => clearTimeout(timer)
    })

    return () => handle.cancel()
  }, [autoConfirm, checkDelayMs, runUpdate])

  useEffect(() => {
    if (!checkOnForeground) return

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') runUpdate()
    }

    const sub = AppState.addEventListener('change', onChange)
    return () => sub.remove()
  }, [checkOnForeground, runUpdate])

  return { status, error, storedVersion, checkNow: runUpdate }
}
