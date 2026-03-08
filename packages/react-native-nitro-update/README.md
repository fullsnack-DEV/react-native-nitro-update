# react-native-nitro-update

OTA (over-the-air) updates for React Native using [Nitro](https://github.com/nitro-render/nitro) and JSI. Check for updates, download bundles, reload, rollback, and manage lifecycle with optional checksum verification, retries, and manifest-based version checks.

## Install

```bash
npm install react-native-nitro-update react-native-nitro-modules
# or
yarn add react-native-nitro-update react-native-nitro-modules
```

**Peer dependencies:** `react`, `react-native`, `react-native-nitro-modules` (e.g. `^0.35.0`).

## Native setup

### iOS — load OTA bundle

Use the **NitroUpdateBundleManager** pod (Swift-only, no C++) in AppDelegate so the app target does not pull in C++ headers. Add the bundle manager pod from the same path as the main library, then in your delegate:

```swift
import NitroUpdateBundleManager

// In your RCTDefaultReactNativeFactoryDelegate (or similar):
override func bundleURL() -> URL? {
#if DEBUG
  return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
  if let otaURL = NitroUpdateBundleManager.getStoredBundleURL() {
    return otaURL
  }
  return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
}
```

**Podfile:** If CocoaPods does not resolve `NitroUpdateBundleManager` automatically (the main `NitroUpdate` pod depends on it), add:

```ruby
pod 'NitroUpdateBundleManager', :path => '../node_modules/react-native-nitro-update'
```

(Adjust the path if your app lives in a subdirectory; e.g. from `example/ios` use `../../node_modules/react-native-nitro-update`.)

### Android — load OTA bundle

Use the stored bundle path when starting the app (e.g. in your `ReactNativeHost` or `ReactHost` setup). When non-null, load the JS bundle from that path instead of the default:

```kotlin
import com.margelo.nitro.nitroupdate.NitroUpdateBundleLoader

// When creating/starting React Native, use:
NitroUpdateBundleLoader.getStoredBundlePath(context)?.let { path ->
  // Use this path as the JS bundle file for release builds
}
```

(Exact integration depends on your RN version and New Architecture; ensure the JS bundle is loaded from this path when available.)

## Quick start

```ts
import {
  checkForUpdate,
  downloadUpdate,
  getStoredVersion,
  reloadApp,
  confirmBundle,
  rollbackToPreviousBundle,
} from 'react-native-nitro-update'

// Check
const hasUpdate = await checkForUpdate('https://example.com/version.txt')

// Download (and optionally confirm after a successful run)
if (hasUpdate) {
  await downloadUpdate('https://example.com/bundle.zip')
  reloadApp()
  // After app restarts, call confirmBundle() once the new bundle runs successfully
  confirmBundle()
}

// Stored version (null if none)
const version = getStoredVersion()

// Rollback if needed
const didRollback = await rollbackToPreviousBundle()
if (didRollback) reloadApp()
```

## API overview

| API | Description |
|-----|-------------|
| `checkForUpdate(versionCheckUrl)` | Returns `true` if remote version is newer and not blacklisted. |
| `downloadUpdate(downloadUrl, bundlePathInZip?, checksum?)` | Downloads zip, extracts bundle, optionally verifies SHA-256. |
| `getStoredVersion()` | Current stored OTA version or `null`. |
| `getStoredBundlePath()` | Path to the stored bundle (or `null`). |
| `reloadApp()` | Restarts the app (iOS/Android). |
| `confirmBundle()` | Marks the current bundle as valid; clears rollback data. |
| `rollbackToPreviousBundle()` | Restores previous bundle; returns `true` if rollback was done. |
| `markCurrentBundleAsBad(reason)` | Blacklists current version and rolls back if possible. |
| `getBlacklistedVersions()` | List of blacklisted version strings. |
| `getRollbackHistory()` | Array of `{ timestamp, fromVersion, toVersion, reason }`. |
| `onUpdateLifecycle(callback)` | Subscribe to download/rollback/confirm/error events. |
| `onRollback(callback)` | Subscribe to rollback events. |
| `scheduleBackgroundCheck(versionCheckUrl, downloadUrl?, intervalSeconds)` | Schedules periodic background check (iOS BGTaskScheduler, Android WorkManager). See below. |

**Retry and manifest:**

- `downloadUpdateWithRetry(downloadUrl, options?, bundlePathInZip?, checksum?)` — exponential backoff retry.
- `checkForUpdateFromManifest(manifestUrl, appVersion?)` — JSON manifest with `version`, `minAppVersion`, `targetVersions`, `bundleUrl`, `checksum`, etc.

See `src/index.ts` and `src/updateManifest.ts` for full types and the `UpdateManager` class.

## Lifecycle

- After `downloadUpdate`, the new bundle is stored and marked **pending validation**. The app should `reloadApp()` and then call `confirmBundle()` once the new bundle has run successfully.
- If the app crashes or you call `markCurrentBundleAsBad(reason)` before confirming, the next launch can roll back to the previous bundle (and the failed version can be blacklisted).
- Use `onUpdateLifecycle` and `onRollback` for UI or analytics.

## Checksum and retry

- **Checksum:** Pass an optional SHA-256 hex string as the third argument to `downloadUpdate`. If the extracted bundle’s hash doesn’t match, the update is aborted.
- **Retry:** Use `downloadUpdateWithRetry` with `RetryOptions` (e.g. `maxRetries`, `initialDelayMs`, `maxDelayMs`) for exponential backoff.

## Manifest

Use `checkForUpdateFromManifest(manifestUrl, appVersion?)` with a JSON manifest that can include:

- `version` — remote bundle version
- `minAppVersion` — minimum app version (optional)
- `targetVersions` — optional list of compatible app versions
- `bundleUrl`, `checksum`, `releaseNotes`, etc.

The helper returns `hasUpdate`, `isCompatible`, `remoteVersion`, and metadata for your UI or download step.

## Rollback and crash safety

- Before applying a new bundle, the library keeps the previous version and path. If you call `confirmBundle()`, that backup is cleared.
- If you don’t confirm (e.g. app crashes), the next launch can use the previous bundle; use `rollbackToPreviousBundle()` or the native loader logic to prefer the last known-good bundle when the current one is pending validation.
- `markCurrentBundleAsBad(reason)` blacklists the current version and restores the previous bundle so it won’t be offered again.

## Comparison with react-native-nitro-ota

This library is inspired by [react-native-nitro-ota](https://github.com/riteshshukla04/react-native-nitro-ota) and follows the same patterns where it makes sense:

| Aspect | react-native-nitro-ota | react-native-nitro-update |
|--------|------------------------|---------------------------|
| **Tech** | Nitro Modules, JSI | Same (Nitro Modules, JSI) |
| **iOS bundle loader** | Separate `NitroOtaBundleManager` pod (Swift-only) | Same: `NitroUpdateBundleManager` pod (Swift-only) to avoid C++ in app target |
| **Version check** | Plain `ota.version` or `ota.version.json` | Plain version URL or JSON manifest (`checkForUpdateFromManifest`) |
| **Download** | Zip from URL, optional progress | Same + optional SHA-256 checksum |
| **Rollback / blacklist** | Yes, crash safety, confirm bundle | Same lifecycle (confirm, rollback, blacklist, history) |
| **Background check** | Experimental (WorkManager / BGTaskScheduler) | Implemented: iOS BGTaskScheduler, Android WorkManager (min 15 min) |
| **Extra in this lib** | — | Manifest-based check (`minAppVersion`, `targetVersions`), retry with backoff, optional checksum |

Same idea: check version → download zip → reload → confirm when the new bundle runs OK; rollback and blacklist if it doesn’t.

## Host your bundle anywhere (same concept as the original)

You put your **bundle zip** and **version file** on any server you want; the app only needs the URLs. The library does not care where they live:

- **CDN** (e.g. CloudFront, Fastly) — use the version and zip URLs.
- **S3 / GCS / Azure Blob** — make the version file and zip publicly readable (or use signed URLs) and pass those URLs.
- **GitHub** — e.g. raw URLs to a file like `https://github.com/you/repo/raw/main/ota.version` and `https://github.com/you/repo/releases/download/v1.0.0/bundle.zip`.
- **Your own backend** — serve a version string and the zip from your API.

So: **one version URL** (plain text or JSON) and **one download URL** (the zip). Same concept as [react-native-nitro-ota](https://github.com/riteshshukla04/react-native-nitro-ota): server-agnostic.

## Background check

Call `scheduleBackgroundCheck(versionCheckUrl, downloadUrl, intervalSeconds)` to run a version check (and optional download) periodically in the background. When an update is found and `downloadUrl` is set, the library downloads and stores the new bundle; the user gets it on the **next app launch** (no reload in background).

- **Android:** Uses WorkManager; minimum interval is **15 minutes**.
- **iOS:** Uses `BGTaskScheduler`; interval is a hint (system may delay). You must:
  1. Enable **Background Modes → Background fetch** in your app’s capabilities.
  2. Add the task identifier to your **Info.plist**:
     ```xml
     <key>BGTaskSchedulerPermittedIdentifiers</key>
     <array>
       <string>com.nitroupdate.backgroundcheck</string>
     </array>
     ```

Example:

```ts
import { scheduleBackgroundCheck } from 'react-native-nitro-update'

scheduleBackgroundCheck(
  'https://your-cdn.com/version.txt',
  'https://your-cdn.com/bundle.zip',
  3600
)
```

## What might be added

- **Download progress**: Native progress callback (e.g. `received` / `total`) exposed to JS so you can show a progress bar (API design exists; native wiring may need completion).
- **GitHub OTA helper**: A small helper like `githubOTA({ githubUrl, otaVersionPath, ref })` that returns `downloadUrl` and `versionUrl` for GitHub raw URLs (convenience only).
- **Expo config plugin**: Document or add an Expo config plugin if you use Expo prebuild.

## Example app

This repo includes an example app in `example/`. From the repo root:

```bash
npm run example:android
npm run example:ios
```

See `example/README.md` for details.

## License

MIT
