import { Platform } from 'react-native'

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
  metadata: UpdateManifest | null
}

/**
 * Fetches update.json (or similar) and checks if there is a compatible update.
 * Compares remote version with current app version when minAppVersion or targetVersions are set.
 */
export async function checkForUpdateFromManifest(
  manifestUrl: string,
  appVersion?: string
): Promise<UpdateCheckResult> {
  const res = await fetch(manifestUrl)
  if (!res.ok) {
    return {
      hasUpdate: false,
      isCompatible: false,
      remoteVersion: null,
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
      metadata,
    }
  }

  let isCompatible = true
  if (appVersion != null && appVersion !== '') {
    if (metadata.minAppVersion != null && metadata.minAppVersion !== '') {
      isCompatible = compareVersions(appVersion, metadata.minAppVersion) >= 0
    }
    if (isCompatible && metadata.targetVersions) {
      const platform = Platform.OS
      const allowed = platform === 'ios' ? metadata.targetVersions.ios : metadata.targetVersions.android
      if (allowed != null && allowed.length > 0) {
        isCompatible = allowed.includes(appVersion)
      }
    }
  }

  return {
    hasUpdate: true,
    isCompatible,
    remoteVersion,
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
