/**
 * Single-URL OTA: host one JSON file anywhere (CDN, S3, Vercel, your server).
 * That file has version + bundleUrl (+ optional checksum, minAppVersion, etc.). You pass one URL in the app.
 */

import { bundleUpdater } from './specs/BundleUpdater.nitro'

export interface OTAConfig {
  /** Current OTA version (any string, e.g. "1.0.2") */
  version: string
  /** Full URL to the bundle zip file */
  bundleUrl: string
  /** Optional SHA-256 hex of the bundle for integrity check */
  checksum?: string
  /** Optional path to the bundle file inside the zip (e.g. "index.ios.jsbundle") if not at root */
  bundlePathInZip?: string
  /** Optional minimum app version that can use this OTA (e.g. "2.30.0"). If app is older, update is skipped. */
  minAppVersion?: string
  /** Optional release notes for UI */
  releaseNotes?: string
}

export interface CheckAndDownloadOptions {
  /** If true, call reloadApp() after a successful download. Default: false (apply on next launch). */
  reloadAfterDownload?: boolean
  /** Current app version for minAppVersion check. If not set, minAppVersion in config is ignored. */
  appVersion?: string
}

/**
 * Fetches your OTA config JSON from a single URL.
 * Host a file like: { "version": "1.0.2", "bundleUrl": "https://...", "checksum": "optional-sha256-hex", "minAppVersion": "2.30.0", "bundlePathInZip": "index.ios.jsbundle" }
 */
export async function fetchOTAConfig(configUrl: string): Promise<OTAConfig> {
  const res = await fetch(configUrl)
  if (!res.ok) {
    throw new Error(`OTA config failed: ${res.status} ${res.statusText}`)
  }
  const json = await res.json()
  if (!json.version || !json.bundleUrl) {
    throw new Error('OTA config must have "version" and "bundleUrl"')
  }
  return {
    version: String(json.version).trim(),
    bundleUrl: String(json.bundleUrl).trim(),
    checksum: json.checksum != null ? String(json.checksum).trim() : undefined,
    bundlePathInZip:
      json.bundlePathInZip != null ? String(json.bundlePathInZip).trim() : undefined,
    minAppVersion:
      json.minAppVersion != null ? String(json.minAppVersion).trim() : undefined,
    releaseNotes: json.releaseNotes != null ? String(json.releaseNotes) : undefined,
  }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0
    const vb = pb[i] ?? 0
    if (va !== vb) return va > vb ? 1 : -1
  }
  return 0
}

/**
 * One-call flow: fetch config from one URL, compare version, download if newer, optionally reload.
 * Use this when you host a single JSON (e.g. https://your-cdn.com/ota.json) with version + bundleUrl.
 *
 * @example
 * const result = await checkAndDownloadFromConfig('https://my-app.com/ota.json')
 * if (result.updated) {
 *   // New bundle saved; use reloadAfterDownload: true to restart now, or let user restart later
 * }
 */
export async function checkAndDownloadFromConfig(
  configUrl: string,
  options: CheckAndDownloadOptions = {}
): Promise<{ updated: boolean; version?: string; skipped?: string }> {
  const { reloadAfterDownload = false, appVersion } = options
  const config = await fetchOTAConfig(configUrl)
  if (config.minAppVersion != null && appVersion != null && appVersion !== '') {
    if (compareVersions(appVersion, config.minAppVersion) < 0) {
      return { updated: false, skipped: 'app_too_old' }
    }
  }
  const stored = bundleUpdater.getStoredVersion() ?? null
  if (stored !== null && stored === config.version) {
    return { updated: false }
  }
  await bundleUpdater.downloadUpdate(
    config.bundleUrl,
    config.bundlePathInZip ?? null,
    config.checksum ?? null
  )
  if (reloadAfterDownload) {
    bundleUpdater.reloadApp()
  }
  return { updated: true, version: config.version }
}

export interface OtaUrlsOptions {
  /** Filename for the version file. Default: 'version.txt' */
  versionFile?: string
  /** Filename for the bundle zip. Default: 'bundle.zip' */
  bundleFile?: string
  /** Optional subfolder under baseUrl, e.g. 'ota' or 'v2'. No leading/trailing slashes. */
  subfolder?: string
}

/**
 * Returns versionUrl and downloadUrl for the "version file + bundle zip" flow.
 * Use when you host version.txt and bundle.zip at a base URL (CDN, S3, Vercel, etc.).
 *
 * @example
 * const { versionUrl, downloadUrl } = otaUrls('https://my-cdn.com/ota')
 * checkForUpdate(versionUrl).then(has => has && downloadUpdate(downloadUrl))
 *
 * @example with subfolder
 * const { versionUrl, downloadUrl } = otaUrls('https://my-cdn.com/assets', { subfolder: 'ota' })
 * // -> .../assets/ota/version.txt and .../assets/ota/bundle.zip
 */
export function otaUrls(
  baseUrl: string,
  versionFileOrOptions: string | OtaUrlsOptions = 'version.txt',
  bundleFile?: string
): { versionUrl: string; downloadUrl: string } {
  const base = baseUrl.replace(/\/$/, '')
  let versionFile = 'version.txt'
  let bundleFileRes = 'bundle.zip'
  let subfolder = ''

  if (typeof versionFileOrOptions === 'string') {
    versionFile = versionFileOrOptions
    bundleFileRes = bundleFile ?? 'bundle.zip'
  } else {
    versionFile = versionFileOrOptions.versionFile ?? 'version.txt'
    bundleFileRes = versionFileOrOptions.bundleFile ?? 'bundle.zip'
    subfolder = versionFileOrOptions.subfolder
      ? `/${versionFileOrOptions.subfolder.replace(/^\/|\/$/g, '')}`
      : ''
  }
  const prefix = `${base}${subfolder}`
  return {
    versionUrl: `${prefix}/${versionFile}`,
    downloadUrl: `${prefix}/${bundleFileRes}`,
  }
}
