import { bundleUpdater, type BundleUpdater } from './specs/BundleUpdater.nitro'

export type { BundleUpdater }

// --- Lifecycle events (single subscription) ---
export type UpdateLifecycleEvent =
  | { type: 'download_start' }
  | { type: 'download_progress'; received: number; total: number }
  | { type: 'download_done' }
  | { type: 'reload_scheduled' }
  | { type: 'rollback'; record?: RollbackRecord }
  | { type: 'confirm' }
  | { type: 'error'; error: unknown }

export interface RollbackRecord {
  timestamp: number
  fromVersion: string
  toVersion: string
  reason: string
}

let lifecycleListener: ((event: UpdateLifecycleEvent) => void) | null = null

export function onUpdateLifecycle(callback: (event: UpdateLifecycleEvent) => void): () => void {
  lifecycleListener = callback
  return () => {
    lifecycleListener = null
  }
}

function emit(event: UpdateLifecycleEvent) {
  lifecycleListener?.(event)
}

// --- Standalone API ---

/**
 * Returns the native app version from Info.plist (iOS) or PackageInfo (Android).
 * Use this to compare against OTA versions or pass to manifest checks.
 */
export function getAppVersion(): string {
  return bundleUpdater.getAppVersion()
}

export function checkForUpdate(versionCheckUrl: string): Promise<boolean> {
  return bundleUpdater.checkForUpdate(versionCheckUrl)
}

/**
 * Download and install an OTA zip. Prefer calling {@link checkForUpdate} first; if you skip it,
 * pass `remoteVersion` so the stored OTA label matches your server (required for `checkAndDownloadFromConfig`).
 */
export function downloadUpdate(
  downloadUrl: string,
  bundlePathInZip?: string | null,
  checksum?: string | null,
  remoteVersion?: string | null
): Promise<void> {
  emit({ type: 'download_start' })
  return bundleUpdater
    .downloadUpdate(
      downloadUrl,
      bundlePathInZip ?? null,
      checksum ?? null,
      remoteVersion ?? null
    )
    .then(() => {
      emit({ type: 'download_done' })
    })
    .catch((err) => {
      emit({ type: 'error', error: err })
      throw err
    })
}

export function getStoredVersion(): string | null {
  const v = bundleUpdater.getStoredVersion()
  return v ?? null
}

export function getStoredBundlePath(): string | null {
  const p = bundleUpdater.getStoredBundlePath()
  return p ?? null
}

export function reloadApp(): void {
  emit({ type: 'reload_scheduled' })
  bundleUpdater.reloadApp()
}

export function confirmBundle(): void {
  bundleUpdater.confirmBundle()
  emit({ type: 'confirm' })
}

export function rollbackToPreviousBundle(): Promise<boolean> {
  return bundleUpdater.rollback().then((ok) => {
    if (ok) {
      getRollbackHistory().then((arr) => {
        const last = arr[arr.length - 1]
        if (last) emit({ type: 'rollback', record: last })
      })
    }
    return ok
  })
}

export function markCurrentBundleAsBad(reason: string): Promise<void> {
  return bundleUpdater.markBundleBad(reason).then(() => {
    getRollbackHistory().then((arr) => {
      const last = arr[arr.length - 1]
      if (last) emit({ type: 'rollback', record: last })
    })
  })
}

export function getBlacklistedVersions(): Promise<string[]> {
  return bundleUpdater.getBlacklist().then((raw) => {
    try {
      return JSON.parse(raw)
    } catch {
      return []
    }
  })
}

export function getRollbackHistory(): Promise<RollbackRecord[]> {
  return bundleUpdater.getRollbackHistory().then((raw) => {
    try {
      return JSON.parse(raw)
    } catch {
      return []
    }
  })
}

export function onRollback(callback: (record: RollbackRecord) => void): () => void {
  const unsub = onUpdateLifecycle((event) => {
    if (event.type === 'rollback' && event.record) callback(event.record)
  })
  return unsub
}

export function scheduleBackgroundCheck(
  versionCheckUrl: string,
  downloadUrl: string | null,
  intervalSeconds: number
): void {
  bundleUpdater.scheduleBackgroundCheck(versionCheckUrl, downloadUrl, intervalSeconds)
}

// --- Retry wrapper ---

export interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
}

const defaultRetryOptions: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30_000,
}

export async function downloadUpdateWithRetry(
  downloadUrl: string,
  options?: RetryOptions,
  bundlePathInZip?: string | null,
  checksum?: string | null,
  remoteVersion?: string | null
): Promise<void> {
  const { maxRetries, initialDelayMs, maxDelayMs } = { ...defaultRetryOptions, ...options }
  let delay = initialDelayMs
  let lastErr: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await downloadUpdate(downloadUrl, bundlePathInZip, checksum, remoteVersion)
      return
    } catch (err) {
      lastErr = err
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, delay))
        delay = Math.min(delay * 2, maxDelayMs)
      }
    }
  }
  throw lastErr
}

// --- Manifest (re-export) ---

export {
  checkForUpdateFromManifest,
  type UpdateManifest,
  type UpdateCheckResult,
} from './updateManifest'

// --- GitHub OTA helper (react-native-nitro-ota style) ---

export { githubOTA, type GithubOTAOptions, type GithubOTAResult } from './githubOTA'

// --- Single-URL OTA (host one JSON anywhere: CDN, S3, Vercel, your server) ---

export {
  fetchOTAConfig,
  checkAndDownloadFromConfig,
  otaUrls,
  type OTAConfig,
  type CheckAndDownloadOptions,
  type OtaUrlsOptions,
} from './otaConfig'

// --- Automatic OTA hook & one-call helper ---

export { useOTAUpdate, type UseOTAUpdateOptions, type UseOTAUpdateResult, type OTAStatus, type InstallMode } from './useOTAUpdate'
export { silentUpdate, type SilentUpdateOptions, type SilentUpdateResult } from './silentUpdate'

// --- UpdateManager class ---

export class UpdateManager {
  constructor(
    private downloadUrl: string,
    private versionCheckUrl?: string | null
  ) {}

  checkForUpdates(): Promise<boolean> {
    if (!this.versionCheckUrl) return Promise.resolve(false)
    return checkForUpdate(this.versionCheckUrl)
  }

  async downloadUpdate(
    onProgress?: (received: number, total: number) => void,
    bundlePathInZip?: string | null,
    checksum?: string | null,
    remoteVersion?: string | null
  ): Promise<void> {
    if (onProgress) emit({ type: 'download_progress', received: 0, total: -1 })
    await downloadUpdate(
      this.downloadUrl,
      bundlePathInZip ?? undefined,
      checksum ?? undefined,
      remoteVersion ?? undefined
    )
  }

  getVersion(): string | null {
    return getStoredVersion()
  }

  getUnzippedPath(): string | null {
    return getStoredBundlePath()
  }

  reloadApp(): void {
    reloadApp()
  }

  confirm(): void {
    confirmBundle()
  }

  rollback(): Promise<boolean> {
    return rollbackToPreviousBundle()
  }

  markAsBad(reason?: string): Promise<void> {
    return markCurrentBundleAsBad(reason ?? 'marked_bad')
  }

  getBlacklist(): Promise<string[]> {
    return getBlacklistedVersions()
  }

  getHistory(): Promise<RollbackRecord[]> {
    return getRollbackHistory()
  }

  onRollback(callback: (record: RollbackRecord) => void): () => void {
    return onRollback(callback)
  }

  scheduleBackgroundCheck(intervalSeconds: number): void {
    if (this.versionCheckUrl) {
      scheduleBackgroundCheck(this.versionCheckUrl, this.downloadUrl, intervalSeconds)
    }
  }
}
