import { type HybridObject, NitroModules } from 'react-native-nitro-modules'

/**
 * Native OTA bundle updater: version check, download, reload, rollback, blacklist, history.
 * Implemented in Swift (iOS) and Kotlin (Android).
 */
interface BundleUpdater extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /** Returns true if the version at versionCheckUrl is newer than the stored one. */
  checkForUpdate(versionCheckUrl: string): Promise<boolean>

  /**
   * Downloads zip from downloadUrl, unzips, and stores the bundle.
   * Optional relative path to the bundle file inside the zip; optional checksum to verify after unzip.
   */
  downloadUpdate(
    downloadUrl: string,
    bundlePathInZip?: string | null,
    checksum?: string | null
  ): Promise<void>

  /** Currently stored OTA version string, or null if none. */
  getStoredVersion(): string | null

  /** Path to the currently active bundle file, or null. */
  getStoredBundlePath(): string | null

  /** Native app version from Info.plist (iOS) or BuildConfig (Android). */
  getAppVersion(): string

  /** Restarts the app so the new bundle is loaded. */
  reloadApp(): void

  /** Marks the current bundle as validated; disables crash rollback guard. */
  confirmBundle(): void

  /** Rolls back to the previous bundle. Returns true on success. */
  rollback(): Promise<boolean>

  /** Blacklists the current bundle and rolls back. Reason is stored in history. */
  markBundleBad(reason: string): Promise<void>

  /** Returns JSON array of blacklisted version strings. */
  getBlacklist(): Promise<string>

  /** Returns JSON array of rollback history records. */
  getRollbackHistory(): Promise<string>

  /** Schedules a background check every intervalSeconds. Pass null downloadUrl to check only. */
  scheduleBackgroundCheck(
    versionCheckUrl: string,
    downloadUrl: string | null,
    intervalSeconds: number
  ): void
}

const bundleUpdater = NitroModules.createHybridObject<BundleUpdater>('BundleUpdater')
export { bundleUpdater }
export type { BundleUpdater }
