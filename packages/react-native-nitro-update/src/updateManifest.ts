import { Platform } from 'react-native'
import { bundleUpdater } from './specs/BundleUpdater.nitro'

/**
 * Structured update manifest (e.g. update.json) for compatibility and release notes.
 */
export interface UpdateManifest {
  version: string
  isSemver?: boolean
  minAppVersion?: string
  targetVersions?: {
    android?: string[]
    ios?: string[]
  }
  bundleUrl?: string
  checksum?: string
  releaseNotes?: string
}

export interface UpdateCheckResult {
  hasUpdate: boolean
  isCompatible: boolean
  remoteVersion: string | null
  appVersion: string
  metadata: UpdateManifest | null
}

/**
 * Fetches update.json (or similar) and checks if there is a compatible update.
 * Compares remote version with current app version when minAppVersion or targetVersions are set.
 * If appVersion is not supplied, reads it from Info.plist / BuildConfig automatically.
 */
export async function checkForUpdateFromManifest(
  manifestUrl: string,
  appVersion?: string
): Promise<UpdateCheckResult> {
  const resolvedAppVersion = appVersion ?? bundleUpdater.getAppVersion()

  const res = await fetch(manifestUrl)
  if (!res.ok) {
    return {
      hasUpdate: false,
      isCompatible: false,
      remoteVersion: null,
      appVersion: resolvedAppVersion,
      metadata: null,
    }
  }
  const metadata: UpdateManifest = await res.json()
  const remoteVersion = metadata.version ?? null
  if (!remoteVersion) {
    return {
      hasUpdate: false,
      isCompatible: false,
      remoteVersion: null,
      appVersion: resolvedAppVersion,
      metadata,
    }
  }

  let isCompatible = true
  if (resolvedAppVersion !== '') {
    if (metadata.minAppVersion != null && metadata.minAppVersion !== '') {
      isCompatible = compareVersions(resolvedAppVersion, metadata.minAppVersion) >= 0
    }
    if (isCompatible && metadata.targetVersions) {
      const platform = Platform.OS
      const allowed = platform === 'ios' ? metadata.targetVersions.ios : metadata.targetVersions.android
      if (allowed != null && allowed.length > 0) {
        isCompatible = allowed.includes(resolvedAppVersion)
      }
    }
  }

  return {
    hasUpdate: true,
    isCompatible,
    remoteVersion,
    appVersion: resolvedAppVersion,
    metadata,
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
