# react-native-nitro-update

OTA (over-the-air) updates for React Native using [Nitro](https://github.com/nitro-render/nitro) and JSI. Check for updates, download bundles, reload, rollback, and manage lifecycle with optional checksum verification, retries, and manifest-based version checks.

**npm:** [react-native-nitro-update](https://www.npmjs.com/package/react-native-nitro-update) — install from the registry in any React Native app; use this README plus **[INTEGRATION.md](./INTEGRATION.md)** for full setup.

## Install

Install the package **and** the required peer **`react-native-nitro-modules`** (npm does not install peers automatically):

```bash
npm install react-native-nitro-update react-native-nitro-modules
```

```bash
yarn add react-native-nitro-update react-native-nitro-modules
```

```bash
bun add react-native-nitro-update react-native-nitro-modules
```

**Peer dependencies:** `react`, `react-native`, `react-native-nitro-modules`. The library supports **Bun** as well as npm and Yarn.

**Quick setup (interactive wizard)** — after installing:

```bash
npx react-native-nitro-update setup
# or, if you added the script: npm run setupOTA
```

The wizard asks how you want to host OTA (GitHub branch, S3, Firebase, API, etc.), then generates config files and a code snippet for your app. It also adds an `ota:build` script so you can build the OTA zip with one command.

**Using this in another project?** See **[INTEGRATION.md](./INTEGRATION.md)** for step-by-step: install, iOS/Android native wiring, JS auto-update snippet, hosting (e.g. GitHub Releases), and building the OTA zip.

---

## CLI

The package ships a CLI. Run from your **project root** (where `package.json` and `ios/` or `android/` live):

| Command | Description |
|--------|-------------|
| `npx react-native-nitro-update build` | Build OTA bundle zip (runs `react-native bundle` + zip). Version is auto-detected from your native project. |
| `npx react-native-nitro-update doctor` | Diagnose setup: Podfile, iOS sources, MainApplication / `jsBundleFilePath`, Swift settings, Metro. Use `--json` for CI. |
| `npx react-native-nitro-update setup` | Interactive wizard: hosting choice, config generation, `OTA_BOOTSTRAP.md`, native/JS snippets. |
| `npx react-native-nitro-update bootstrap` | Write `OTA_BOOTSTRAP.md` only (checklist + snippets; reads `ota-config.js` `baseUrl` if present). |

### Building the OTA zip (recommended)

Use the **package-hosted** build command so you get improvements with every package update — no generated scripts to maintain:

```bash
# Auto-generates OTA version from native version + build number + UTC stamp
npx react-native-nitro-update build --platform ios

# Explicit version and platform
npx react-native-nitro-update build --platform android --version 1.0.2

# Both platforms, custom output directory
npx react-native-nitro-update build --platform both --output ./my-ota
```

**Options:** `--platform ios|android|both` (default: ios), `--version <string>` (explicit override), `--entry <file>` (default: index.js), `--output <dir>` (default: ./ota-output), `--dev`. Run `npx react-native-nitro-update build --help` for details.
By default, `version.txt` is generated as `<nativeVersion>+ota.<build>.<UTCSTAMP>` (example: `1.1.100+ota.100.202603191230`) to avoid collisions with future App Store/Play Store versions.
When this `+ota` format is used, native `checkForUpdate` only accepts OTA versions whose `<nativeVersion>` matches the currently running app version.

After running, upload `ota-output/version.txt` and `ota-output/bundle.zip` to your CDN, GitHub Release, or S3. You can add a script to `package.json`:

```json
"ota:build": "npx react-native-nitro-update build --platform ios"
```

Then run `npm run ota:build` whenever you want to ship an OTA.

## Step-by-step: How to use this library

1. **Install** the package and peer dependency (see above).

2. **Host two URLs somewhere** (your server, CDN, S3, or GitHub):
   - A **version URL** that returns a single version string (e.g. `1.0.0`) or a JSON manifest.
   - A **download URL** that serves a **zip file** containing your JS bundle (and optionally assets). The zip can contain the bundle at the root or in a subfolder; the library can auto-detect or you can pass `bundlePathInZip`.

3. **Wire native so the app loads the OTA bundle when present:**
   - **iOS:** In AppDelegate, use `NitroUpdateBundleManager.getStoredBundleURL()` in your `bundleURL()` (see [Native setup – iOS](#ios--load-ota-bundle)). Add the `NitroUpdateBundleManager` pod in the Podfile if needed.
   - **Android:** When building the React Native host, use `NitroUpdateBundleLoader.getStoredBundlePath(context)`; when it’s non-null, load the JS bundle from that path (see [Native setup – Android](#android--load-ota-bundle)).
   - Native loaders automatically recover from unconfirmed OTA crash loops (`pendingValidation`), so host apps do not need custom rollback patches in `AppDelegate`/`MainApplication`.

4. **In your app (JS):** Call `checkForUpdate(versionUrl)`. If it returns `true`, call `downloadUpdate(downloadUrl)`, then `reloadApp()`. After the app restarts on the new bundle, call `confirmBundle()` once you know the new bundle runs correctly (e.g. after a successful API call or screen load).  
   **Version rule:** change the remote version string on **every** OTA you publish (`version.txt` or JSON `version`). Comparison is by **exact string**; unchanged text means no update. Prefer `checkForUpdate` → `downloadUpdate` in that order; or use `checkAndDownloadFromConfig` for a single JSON URL (it passes `version` to native automatically). If you must call `downloadUpdate` without a prior check, use `downloadUpdate(url, bundlePathInZip, checksum, remoteVersion)`.

5. **Optional:** Use `checkForUpdateFromManifest(manifestUrl)` for a JSON manifest with `version`, `minAppVersion`, `bundleUrl`, `checksum`, etc. Use `checkAndDownloadFromConfig(configUrl)` when one JSON holds `version` + `bundleUrl`. Use `downloadUpdateWithRetry()` for retries. Use `scheduleBackgroundCheck(versionUrl, downloadUrl, intervalSeconds)` so the app checks for updates in the background (iOS: add Background Modes + task identifier; see [Background check](#background-check)).

6. **If something goes wrong:** Call `rollbackToPreviousBundle()` then `reloadApp()`, or `markCurrentBundleAsBad(reason)`. Use `getRollbackHistory()` and `onRollback()` for analytics or UI.

That’s the full flow: **host version + zip → native loads stored bundle when present → JS checks, downloads, reloads, confirms.**

**When does the OTA apply for users?** If you ship a physical (release) build and host the zip on a GitHub release: the app checks for updates shortly after launch, downloads the new bundle in the background while the user keeps using the app, then (in the example) calls `reloadApp()` so the **next cold start** loads the new bundle. For a step-by-step diagram and “you do this / user sees this”, see the example’s [OTA-FLOW.md](../../example/OTA-FLOW.md).

## Native setup

**React Native 0.76+** templates usually use a **Swift factory delegate** (`bundleURL()` / `sourceURL(for:)`) and Android **`getDefaultReactHost`**. Canonical copy-paste sources:

- iOS: [AppDelegate.swift in the example app](https://github.com/fullsnack-DEV/react-native-nitro-update/blob/main/example/ios/NitroUpdateExample/AppDelegate.swift)
- Android: [MainApplication.kt in the example app](https://github.com/fullsnack-DEV/react-native-nitro-update/blob/main/example/android/app/src/main/java/com/nitroupdateexample/MainApplication.kt)

See **[INTEGRATION.md](./INTEGRATION.md)** for Podfile, ObjC, and older `ReactNativeHost` patterns.

### iOS — load OTA bundle

Use the **NitroUpdateBundleManager** pod (Swift + ObjC/ObjC++, no C++) in AppDelegate so the app target does not pull in C++ headers. Add the bundle manager pod from the same path as the main library, then in your delegate:

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
`NitroUpdateBundleManager.getStoredBundleURL()` includes automatic recovery if a pending OTA bundle crashes before `confirmBundle()`.

If your app uses `AppDelegate.m`/`AppDelegate.mm`, use the ObjC API:

```objc
#import <NitroUpdateBundleManager/NitroUpdateBundleManagerObjC.h>

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  NSURL *otaURL = [NitroUpdateBundleManagerObjC getStoredBundleURL];
  return otaURL ?: [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}
```

Do not add custom host-side rollback/crash patching in `AppDelegate`; loader and crash-guard rollback are handled by this library.

### Android — load OTA bundle

**New Architecture default (`getDefaultReactHost`, RN 0.76+):** pass the OTA path as `jsBundleFilePath` (see [example MainApplication.kt](https://github.com/fullsnack-DEV/react-native-nitro-update/blob/main/example/android/app/src/main/java/com/nitroupdateexample/MainApplication.kt)):

```kotlin
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.margelo.nitro.nitroupdate.NitroUpdateBundleLoader

override val reactHost: ReactHost by lazy {
  getDefaultReactHost(
    context = applicationContext,
    packageList = PackageList(this).packages,
    jsBundleFilePath = NitroUpdateBundleLoader.getStoredBundlePath(this),
  )
}
```

**Older `ReactNativeHost`:** override `getJSBundleFile()` (or equivalent) to return `NitroUpdateBundleLoader.getStoredBundlePath(this)` when non-null in release.

`NitroUpdateBundleLoader.getStoredBundlePath(context)` includes the same automatic pending-validation crash recovery on Android.

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
| `getAppVersion()` | Native app version from Info.plist (iOS) or BuildConfig (Android). |
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
- If the app crashes before `confirmBundle()`, native bundle loaders automatically recover on next launch by restoring the previous bundle (or embedded fallback when no previous bundle exists).
- You can also call `markCurrentBundleAsBad(reason)` to blacklist the bad version and force rollback immediately.
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
| **iOS bundle loader** | Separate `NitroOtaBundleManager` pod | Same: `NitroUpdateBundleManager` pod (Swift + ObjC/ObjC++) to avoid C++ in app target |
| **Version check** | Plain `ota.version` or `ota.version.json` | Plain version URL or JSON manifest (`checkForUpdateFromManifest`) |
| **Download** | Zip from URL, optional progress | Same + optional SHA-256 checksum |
| **Rollback / blacklist** | Yes, crash safety, confirm bundle | Same lifecycle (confirm, rollback, blacklist, history) |
| **Background check** | Experimental (WorkManager / BGTaskScheduler) | Implemented: iOS BGTaskScheduler, Android WorkManager (min 15 min) |
| **Extra in this lib** | — | Manifest-based check (`minAppVersion`, `targetVersions`), retry with backoff, optional checksum, **package-hosted build CLI** (`npx react-native-nitro-update build`) |

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

## GitHub OTA helper (react-native-nitro-ota style)

Like [react-native-nitro-ota](https://github.com/riteshshukla04/react-native-nitro-ota), you can use a `githubOTA()` helper to build version and download URLs from a GitHub repo:

```ts
import { githubOTA, checkForUpdate, downloadUpdate, reloadApp } from 'react-native-nitro-update'

// Option 1: Use Releases (recommended) — one app build; create a new Release for each OTA
const { versionUrl, downloadUrl } = githubOTA({
  githubUrl: 'https://github.com/your-username/your-ota-repo',
  otaVersionPath: 'version.txt',
  bundlePath: 'bundle.zip',
  useReleases: true,
})

// Option 2: Use a branch (raw) — push version.txt and bundle.zip to main
const { versionUrl, downloadUrl } = githubOTA({
  githubUrl: 'https://github.com/your-username/your-ota-repo',
  otaVersionPath: 'version.txt',
  ref: 'main',
  useReleases: false,
})

const hasUpdate = await checkForUpdate(versionUrl)
if (hasUpdate) {
  await downloadUpdate(downloadUrl)
  reloadApp()
}
```

| Option        | versionUrl / downloadUrl |
|---------------|---------------------------|
| `useReleases: true`  | `https://github.com/owner/repo/releases/latest/download/version.txt` and `.../bundle.zip` |
| `useReleases: false` | `https://raw.githubusercontent.com/owner/repo/ref/version.txt` and `.../bundle.zip` |

## What might be added

- **Download progress**: Native progress callback (e.g. `received` / `total`) exposed to JS so you can show a progress bar (API design exists; native wiring may need completion).
- **Expo config plugin**: Document or add an Expo config plugin if you use Expo prebuild.

## Example app

This repo includes an example app in `example/`. From the repo root:

```bash
npm run example:android
npm run example:ios
```

See `example/README.md` for details.

## Compatibility with react-native-nitro-modules

This package is kept compatible with current **react-native-nitro-modules** so consumers do not need patches:

- **Swift:** Generated autolinking uses `HybridView` (not `RecyclableView`).
- **C++:** The generated Swift bridge does not mark `equals()` with `override` (since `HybridObject::equals` is not virtual in NitroModules).
- **Build:** Your app `Podfile` should include NitroUpdate pod utils in `post_install`:
  - `require_relative '../node_modules/react-native-nitro-update/scripts/nitro_update_pod_utils'`
  - `NitroUpdatePodUtils.apply!(installer)`
  This sanitizes `SWIFT_ACTIVE_COMPILATION_CONDITIONS` and moves invalid compiler flags to `OTHER_SWIFT_FLAGS`.

If you hit:

`Conditional compilation flags must be valid Swift identifiers (rather than '-enable-bare-slash-regex')`

add the Podfile wiring above and re-run `cd ios && pod install && cd ..`.

After running `npm run specs` (Nitrogen), `scripts/post-nitrogen-fix.sh` is run automatically to re-apply the Swift and C++ compatibility fixes to the generated files.

## Publishing to npm

To publish this package to the public npm registry, see **[PUBLISHING.md](./PUBLISHING.md)** for prerequisites (npm account, 2FA), versioning, and the exact `npm publish` steps.

## License

MIT
