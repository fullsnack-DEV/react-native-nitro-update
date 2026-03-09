# Using react-native-nitro-update in your own project

Follow these steps to add OTA updates to **any** React Native app.

---

## 1. Install

In your project root:

```bash
npm install react-native-nitro-update
# or
yarn add react-native-nitro-update
```

**Peer dependencies:** `react`, `react-native`. The library brings in `react-native-nitro-modules` automatically.

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

**If you use `RCTBundleURLProvider` elsewhere:** replace that with the same logic: in release, prefer `NitroUpdateBundleManager.getStoredBundleURL()`, then fall back to `Bundle.main.url(forResource: "main", withExtension: "jsbundle")`.

The important part: **release builds** must call `NitroUpdateBundleManager.getStoredBundleURL()` first so the next launch after an OTA download uses the new bundle.

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

---

## 3. Android native setup

When creating the React Native host (e.g. in `MainApplication` or wherever you set the JS bundle path), use the stored OTA path when available:

```kotlin
import com.margelo.nitro.nitroupdate.NitroUpdateBundleLoader

// When building the bundle path for release:
val bundlePath = NitroUpdateBundleLoader.getStoredBundlePath(context)
if (bundlePath != null) {
  // Load JS bundle from this path (exact API depends on your RN / New Arch setup)
  // e.g. pass bundlePath to your ReactNativeHost or ReactHost configuration
} else {
  // Load from assets or default location
}
```

The exact code depends on your React Native version and whether you use the New Architecture. The library only provides `getStoredBundlePath(context)`; your app must pass that path into the place that loads the JS bundle.

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

# Zip (bundle file name must match what the library expects; typically index.ios.jsbundle or main.jsbundle)
cd ota-release
zip bundle.zip index.ios.jsbundle version.txt
# Or for Android: use the android bundle output and same version.txt
```

Then upload `version.txt` and `bundle.zip` to your release or CDN. The library expects the zip to contain the JS bundle file (e.g. `index.ios.jsbundle` or `main.jsbundle`) and will use it after unzipping.

---

## 7. Optional: rollback and confirm

- **confirmBundle()** – Call once after the app has run successfully on the new bundle (e.g. after a key screen loads). This disables the crash rollback guard for that bundle.
- **rollbackToPreviousBundle()** – If something goes wrong, you can offer a “Roll back” action that restores the previous bundle; then the user restarts the app.

---

## 8. Summary checklist

| Step | What to do |
|------|------------|
| 1 | `npm install react-native-nitro-update react-native-nitro-modules` |
| 2 | iOS: Add `NitroUpdateBundleManager` pod and implement `bundleURL()` to prefer OTA bundle in release |
| 3 | Android: Use `NitroUpdateBundleLoader.getStoredBundlePath(context)` when loading the JS bundle in release |
| 4 | JS: Call `checkForUpdate` → `downloadUpdate` after launch (e.g. in `useEffect` + `InteractionManager`), **without** calling `reloadApp()` |
| 5 | Host `version.txt` and `bundle.zip` (e.g. GitHub Releases or your CDN) |
| 6 | Build the zip with `react-native bundle` + `zip`, then upload for each new OTA version |

Result: users get the update in the background; the new bundle is used on the **next** app cold start.
