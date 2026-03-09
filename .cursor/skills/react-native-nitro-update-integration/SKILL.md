---
name: react-native-nitro-update-integration
description: Integrates react-native-nitro-update OTA updates into a React Native app. Use when the user wants to add OTA updates, use react-native-nitro-update in another project, or integrate this library into an existing app.
---

# react-native-nitro-update integration

Step-by-step guide to add OTA updates to any React Native app using `react-native-nitro-update`. Apply when the user is in a different project and wants to use this library.

## 1. Install

In the **current project** root (the app where OTA will be added):

```bash
npm install react-native-nitro-update
```

No separate nitro package: the library installs `react-native-nitro-modules` automatically.

## 2. iOS

### Podfile

Path relative to `ios/`. Replace `YourAppName` with the app target name.

```ruby
target 'YourAppName' do
  config = use_native_modules!
  pod 'NitroUpdateBundleManager', :path => '../node_modules/react-native-nitro-update'

  use_react_native!(...)
  # ...
end
```

Then: `cd ios && pod install && cd ..`

### AppDelegate (bundle URL)

In the class that provides the JS bundle URL (e.g. `RCTDefaultReactNativeFactoryDelegate` or equivalent), add:

```swift
import NitroUpdateBundleManager

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

If C++ build errors appear, add in Podfile `post_install`:

```ruby
installer.pods_project.targets.each do |target|
  target.build_configurations.each do |config|
    config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'
    config.build_settings['CLANG_CXX_STANDARD_LIBRARY'] = 'libc++'
  end
end
```

## 3. Android

Where the app sets the JS bundle path (e.g. `MainApplication` / `ReactNativeHost`), use the stored OTA path in release:

```kotlin
import com.margelo.nitro.nitroupdate.NitroUpdateBundleLoader

// When building bundle path for release:
val bundlePath = NitroUpdateBundleLoader.getStoredBundlePath(context)
if (bundlePath != null) {
  // Load JS bundle from this path (wire into ReactNativeHost/ReactHost for your RN version)
} else {
  // Load from default / assets
}
```

## 4. JavaScript: auto OTA (apply on next launch)

In the **root component** (e.g. `App.tsx`):

- Use `githubOTA()` for GitHub Releases, or set `VERSION_URL` and `DOWNLOAD_URL` to your own CDN.
- Run `checkForUpdate` → `downloadUpdate` after mount; **do not** call `reloadApp()` so the update applies on the next cold start.

```ts
import { useEffect, useRef, useCallback } from 'react'
import { InteractionManager } from 'react-native'
import {
  checkForUpdate,
  downloadUpdate,
  confirmBundle,
  getStoredVersion,
  githubOTA,
} from 'react-native-nitro-update'

const { versionUrl, downloadUrl } = githubOTA({
  githubUrl: 'https://github.com/YOUR_ORG/YOUR_OTA_REPO',
  otaVersionPath: 'version.txt',
  bundlePath: 'bundle.zip',
  useReleases: true,
})

export default function App() {
  const runningRef = useRef(false)

  const runOTACheck = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    try {
      if (getStoredVersion()) confirmBundle()
      const hasUpdate = await checkForUpdate(versionUrl)
      if (hasUpdate) await downloadUpdate(downloadUrl)
    } catch (_) {}
    finally { runningRef.current = false }
  }, [])

  useEffect(() => {
    const h = InteractionManager.runAfterInteractions(() => {
      const t = setTimeout(runOTACheck, 2000)
      return () => clearTimeout(t)
    })
    return () => h.cancel()
  }, [runOTACheck])

  return (/* your app UI */)
}
```

## 5. Hosting and building the zip

- **Version URL**: plain text file with one line (e.g. `1.0.0`).
- **Download URL**: zip containing the JS bundle file (e.g. `index.ios.jsbundle` or `main.jsbundle`) and `version.txt`.

**GitHub Releases:** Create a repo, create a Release, upload `version.txt` and `bundle.zip`. Use `githubOTA({ githubUrl: '...', useReleases: true })`.

**Build zip** (from app project root):

```bash
mkdir -p ota-out
echo "1.0.1" > ota-out/version.txt
npx react-native bundle --platform ios --dev false --entry-file index.js \
  --bundle-output ota-out/index.ios.jsbundle --assets-dest ota-out
cd ota-out && zip bundle.zip index.ios.jsbundle version.txt
```

Upload `version.txt` and `bundle.zip` to the release or CDN.

## Checklist

| Step | Action |
|------|--------|
| 1 | `npm install react-native-nitro-update` |
| 2 | iOS: Add `NitroUpdateBundleManager` pod; in release `bundleURL()` prefer `getStoredBundleURL()` then embedded bundle |
| 3 | Android: Use `NitroUpdateBundleLoader.getStoredBundlePath(context)` when loading JS bundle in release |
| 4 | JS: In root component, run `checkForUpdate` → `downloadUpdate` after launch (e.g. `InteractionManager` + 2s delay); do **not** call `reloadApp()` |
| 5 | Host `version.txt` and `bundle.zip` (e.g. GitHub Releases) |
| 6 | For each OTA: bump version, run bundle + zip, upload |

Result: update downloads in background; new bundle is used on **next** app cold start.
