import {
  checkForUpdate,
  downloadUpdate,
  reloadApp,
} from './index'

export interface SilentUpdateOptions {
  /** URL to check the remote version string */
  versionUrl: string
  /** URL to download the OTA zip */
  downloadUrl: string
  /**
   * - 'on_next_restart' (default): store the bundle; it loads on next cold start.
   * - 'immediate': call reloadApp() right after download (app closes and relaunches).
   */
  installMode?: 'on_next_restart' | 'immediate'
}

export interface SilentUpdateResult {
  /** Whether a new bundle was downloaded */
  updated: boolean
  /** Error message if the process failed */
  error?: string
}

/**
 * One-call OTA update: check → download → optionally reload.
 *
 * Use this outside of React components (e.g. in an AppDelegate callback,
 * a background task, or a navigation listener).
 *
 * @example
 * ```ts
 * import { silentUpdate, githubOTA } from 'react-native-nitro-update'
 *
 * const urls = githubOTA({ githubUrl: 'https://github.com/you/ota-repo', useReleases: true })
 *
 * silentUpdate({
 *   versionUrl: urls.versionUrl,
 *   downloadUrl: urls.downloadUrl,
 * }).then(({ updated }) => {
 *   if (updated) console.log('OTA bundle ready for next launch')
 * })
 * ```
 */
export async function silentUpdate(options: SilentUpdateOptions): Promise<SilentUpdateResult> {
  const { versionUrl, downloadUrl, installMode = 'on_next_restart' } = options

  try {
    const hasUpdate = await checkForUpdate(versionUrl)
    if (!hasUpdate) return { updated: false }

    await downloadUpdate(downloadUrl)

    if (installMode === 'immediate' && !__DEV__) {
      reloadApp()
    }

    return { updated: true }
  } catch (e) {
    return { updated: false, error: (e as Error).message }
  }
}
