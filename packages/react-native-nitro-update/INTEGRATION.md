# Using react-native-nitro-update in your own project

Follow these steps to add OTA updates to **any** React Native app.

**Package on npm:** [react-native-nitro-update](https://www.npmjs.com/package/react-native-nitro-update)

---

## 1. Install

In your project root, install the library **and** the required peer **`react-native-nitro-modules`** (npm does not auto-install peers):

```bash
npm install react-native-nitro-update react-native-nitro-modules
```

```bash
yarn add react-native-nitro-update react-native-nitro-modules
```

```bash
bun add react-native-nitro-update react-native-nitro-modules
```

**Peer dependencies:** `react`, `react-native`, `react-native-nitro-modules`.

**After install:** run `npx react-native-nitro-update doctor` from your app root to verify Podfile, native loaders, and dependencies.

---

## 1.1 Golden path: React Native 0.76+ (New Architecture default template)

If your app uses the current default **Swift `RCTDefaultReactNativeFactoryDelegate`** (or equivalent) and Android **`getDefaultReactHost`**, copy the same wiring as the reference app (paths are from the library repo on GitHub):

| Platform | Reference file |
|----------|----------------|
| **iOS** | [example/ios/NitroUpdateExample/AppDelegate.swift](https://github.com/fullsnack-DEV/react-native-nitro-update/blob/main/example/ios/NitroUpdateExample/AppDelegate.swift) — `import NitroUpdateBundleManager`, delegate `bundleURL()` prefers `NitroUpdateBundleManager.getStoredBundleURL()` in release |
| **Android** | [example/android/app/src/main/java/com/nitroupdateexample/MainApplication.kt](https://github.com/fullsnack-DEV/react-native-nitro-update/blob/main/example/android/app/src/main/java/com/nitroupdateexample/MainApplication.kt) — pass `jsBundleFilePath = NitroUpdateBundleLoader.getStoredBundlePath(this)` into `getDefaultReactHost` |

Monorepo clones can open the same files under `example/` in this repository.

**Expo:** OTA requires **custom native code** (Podfile + bundle URL hooks). Use a **development build** / `expo prebuild` and apply the same native steps as a bare React Native app, or stay on **EAS Update** for managed workflows. This library does not ship an Expo config plugin yet.

---

## 2. iOS native setup

### 2.1 Podfile

Add the bundle manager pod (path relative to `ios/`):

```ruby
target 'YourAppName' do
  config = use_native_modules!
  pod 'NitroUpdateBundleManager', :path => '../node_modules/react-native-nitro-update'

  use_react_native!(...)
  # ...
end
```

Also wire the NitroUpdate Podfile utilities in `post_install` (required to sanitize broken Swift flags in some RN/Xcode setups):

```ruby
require_relative '../node_modules/react-native-nitro-update/scripts/nitro_update_pod_utils'

post_install do |installer|
  # ... your existing post_install (for example react_native_post_install)
  NitroUpdatePodUtils.apply!(installer)
end
```

Then:

```bash
cd ios && pod install && cd ..
```

### 2.2 AppDelegate – load OTA bundle on launch

Your app must choose **which** JS bundle to load when it starts. In **release** builds, if an OTA bundle exists on disk, load it; otherwise load the embedded bundle. In **DEBUG**, keep loading from Metro.

How you do this depends on your React Native version:

**If you have a custom delegate that implements `bundleURL()` (or `sourceURL(for:)`):**

```swift
import NitroUpdateBundleManager

// In the class that provides the bundle URL (e.g. RCTDefaultReactNativeFactoryDelegate):
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

**If you use `AppDelegate.m` / `AppDelegate.mm`:**

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

**If you use `RCTBundleURLProvider` elsewhere:** replace that with the same logic: in release, prefer `NitroUpdateBundleManager.getStoredBundleURL()`, then fall back to `Bundle.main.url(forResource: "main", withExtension: "jsbundle")`.

The important part: **release builds** must call `NitroUpdateBundleManager.getStoredBundleURL()` first so the next launch after an OTA download uses the new bundle.
`getStoredBundleURL()` also performs automatic recovery for unconfirmed OTA crashes (`pendingValidation`), so consumers do not need custom rollback logic in AppDelegate.
For ObjC/ObjC++ entrypoints, `NitroUpdateBundleManagerObjC.getStoredBundleURL()` provides the same behavior.
Do **not** add app-side custom rollback/crash patches; rollback is owned by the library loader/crash guard.

### 2.3 C++ build settings (if you hit C++ errors)

If the app or Pods fail to build with C++/Nitro errors, ensure C++17/20 and libc++ are set. In your `ios/Podfile` `post_install`:

```ruby
post_install do |installer|
  # ... your existing post_install ...
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'
      config.build_settings['CLANG_CXX_STANDARD_LIBRARY'] = 'libc++'
    end
  end
end
```

`NitroUpdatePodUtils.apply!(installer)` also sanitizes `SWIFT_ACTIVE_COMPILATION_CONDITIONS` so it only contains Swift identifiers (e.g. `DEBUG`) and moves compiler flags to `OTHER_SWIFT_FLAGS`.

Troubleshooting:

If you hit this exact error during iOS build:

`Conditional compilation flags must be valid Swift identifiers (rather than '-enable-bare-slash-regex')`

it means your Podfile is missing the NitroUpdate sanitizer wiring above (or pods were not reinstalled after adding it). Add the snippet in `Podfile` and re-run:

```bash
cd ios && pod install && cd ..
```

See the [example Podfile](../../example/ios/Podfile) for a working reference.

---

## 3. Android native setup

The library exposes `NitroUpdateBundleLoader.getStoredBundlePath(context)`; you must pass that path (when non-null) into whatever API loads the JS bundle for **release** builds.

### 3.1 New Architecture default (`getDefaultReactHost`, RN 0.76+)

Use the same pattern as the [example `MainApplication.kt`](https://github.com/fullsnack-DEV/react-native-nitro-update/blob/main/example/android/app/src/main/java/com/nitroupdateexample/MainApplication.kt):

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

When there is no OTA bundle yet, `getStoredBundlePath` returns `null` and React Native falls back to the embedded bundle.

### 3.2 Older `ReactNativeHost` templates

Override `getJSBundleFile()` (or your template’s equivalent) so that in release you return `NitroUpdateBundleLoader.getStoredBundlePath(this)` when non-null, otherwise the default asset bundle path.

`getStoredBundlePath(context)` includes the same automatic pending-validation crash recovery on Android.

---

## 4. JavaScript: auto OTA on launch (no app close)

Add this pattern so the app checks for updates shortly after launch, downloads in the background, and applies the new bundle **on the next cold start** (no forced restart).

### 4.1 URLs

You need two URLs:

- **Version URL** – returns a plain text version string (e.g. `1.0.0`).
- **Download URL** – returns a zip file containing your JS bundle and a `version.txt`.

**Using GitHub Releases (recommended):**

```ts
import { githubOTA } from 'react-native-nitro-update'

const { versionUrl, downloadUrl } = githubOTA({
  githubUrl: 'https://github.com/YOUR_ORG/YOUR_OTA_REPO',
  otaVersionPath: 'version.txt',
  bundlePath: 'bundle.zip',
  useReleases: true,
})
```

Then use `versionUrl` and `downloadUrl` below.

### 4.2 Run OTA check after launch

In your **root component** (e.g. `App.tsx`), run the check once after mount:

```ts
import { useEffect, useRef, useCallback } from 'react'
import { InteractionManager } from 'react-native'
import {
  checkForUpdate,
  downloadUpdate,
  confirmBundle,
  getStoredVersion,
} from 'react-native-nitro-update'

const VERSION_URL = 'https://your-cdn.com/version.txt'  // or versionUrl from githubOTA()
const DOWNLOAD_URL = 'https://your-cdn.com/bundle.zip'   // or downloadUrl from githubOTA()

export default function App() {
  const runningRef = useRef(false)

  const runOTACheck = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    try {
      const current = getStoredVersion()
      if (current) confirmBundle()  // Mark current bundle as healthy

      const hasUpdate = await checkForUpdate(VERSION_URL)
      if (!hasUpdate) return

      await downloadUpdate(DOWNLOAD_URL)
      // New bundle is now on disk. It will load on next app cold start.
      // Optionally: show a subtle “Update ready. Restart to apply.” or do nothing.
    } catch (e) {
      // Log or ignore
    } finally {
      runningRef.current = false
    }
  }, [])

  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      const timer = setTimeout(runOTACheck, 2000)  // 2s delay so startup stays smooth
      return () => clearTimeout(timer)
    })
    return () => handle.cancel()
  }, [runOTACheck])

  return (/* your app UI */)
}
```

Important: **do not** call `reloadApp()` after `downloadUpdate()` if you want “download in background, apply on next launch”. The bundle is already saved; the next time the user opens the app, the native side will load it via `getStoredBundleURL()` / `getStoredBundlePath()`.

---

## 5. Hosting the OTA files

You need to host:

1. **version.txt** – single line, e.g. `1.0.1`
2. **bundle.zip** – zip containing your JS bundle file and the same version file

### Option A: GitHub Releases

1. Create a repo (e.g. `my-app-ota`).
2. For each OTA release, create a **GitHub Release** and upload:
   - `version.txt` (content: e.g. `1.0.1`)
   - `bundle.zip` (see “Build the zip” below)
3. Use `githubOTA({ githubUrl: 'https://github.com/org/my-app-ota', useReleases: true })` so the app uses `releases/latest/download/version.txt` and `releases/latest/download/bundle.zip`.

### Option B: Your own server / CDN

Put `version.txt` and `bundle.zip` at two URLs and pass those URLs to `checkForUpdate(versionUrl)` and `downloadUpdate(downloadUrl)`.

---

## 6. Build the zip for each OTA

**Recommended:** use the package-hosted CLI (OTA version is auto-generated from native version + build number + UTC stamp, assets included automatically):

```bash
# From your project root
npx react-native-nitro-update build --platform ios
# Or both platforms:
npx react-native-nitro-update build --platform both
```

Output goes to `ota-output/` by default: `version.txt` and `bundle.zip`. Upload both to your release or CDN. Add a script to `package.json` if you like: `"ota:build": "npx react-native-nitro-update build --platform ios"`.
Default `version.txt` format is `<nativeVersion>+ota.<build>.<UTCSTAMP>` (for example `1.1.100+ota.100.202603191230`), which avoids conflicts when your next app binary uses a version like `1.1.101`.
With this format, `checkForUpdate` also enforces app-version compatibility by only accepting OTA entries whose `<nativeVersion>` matches the running app.

**Manual build** (if you prefer or need custom paths):

From your **project root**, using your app’s entry file and bundle name:

```bash
# Create a folder (e.g. ota-release)
mkdir -p ota-release
echo "1.0.1" > ota-release/version.txt

# Bundle (adjust --entry-file and --bundle-output to match your app)
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output ota-release/index.ios.jsbundle \
  --assets-dest ota-release

# Zip - IMPORTANT: include the assets folder if your app uses images
cd ota-release
zip -r bundle.zip index.ios.jsbundle assets version.txt
# Or for Android: use the android bundle output and same version.txt
```

**Important:** If your app uses images via `require('./image.png')` or similar, you **must** include the `assets` folder in the zip. The package-hosted `build` command does this automatically. For manual builds, use the `-r` flag so the assets directory is included. Without it, images will not load from OTA bundles.

Then upload `version.txt` and `bundle.zip` to your release or CDN. The library expects the zip to contain the JS bundle file (e.g. `index.ios.jsbundle` or `main.jsbundle`) and will use it after unzipping. Assets are extracted alongside the bundle and will be resolved by React Native.

---

## 7. Optional: rollback and confirm

- **confirmBundle()** – Call once after the app has run successfully on the new bundle (e.g. after a key screen loads). This disables the crash rollback guard for that bundle.
- **rollbackToPreviousBundle()** – If something goes wrong, you can offer a “Roll back” action that restores the previous bundle; then the user restarts the app.

---

## 8. Summary checklist

| Step | What to do |
|------|------------|
| 1 | `npm install react-native-nitro-update react-native-nitro-modules` (required peer) |
| 2 | Optional: `npx react-native-nitro-update bootstrap` → writes **`OTA_BOOTSTRAP.md`** (native checklist). Run **`npx react-native-nitro-update doctor`** to verify. |
| 3 | iOS: Add `NitroUpdateBundleManager` pod + `NitroUpdatePodUtils.apply!`; implement `bundleURL()` to prefer OTA bundle in release (see §1.1 golden path for RN 0.76+) |
| 4 | Android: Pass `NitroUpdateBundleLoader.getStoredBundlePath(context)` into `jsBundleFilePath` for `getDefaultReactHost` (RN 0.76+), or equivalent for older hosts |
| 5 | JS: Call `checkForUpdate` → `downloadUpdate` after launch (e.g. in `useEffect` + `InteractionManager`), **without** calling `reloadApp()` if you want next-launch apply |
| 6 | Host `version.txt` and `bundle.zip` (e.g. GitHub Releases or your CDN) |
| 7 | Build the zip: `npx react-native-nitro-update build --platform ios` (or manual `react-native bundle` + `zip`), then upload for each new OTA version |

Result: users get the update in the background; the new bundle is used on the **next** app cold start.
