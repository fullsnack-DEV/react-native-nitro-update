# Nitro OTA Example

Example app for `react-native-nitro-update`. Uses the library from the monorepo (`file:../packages/react-native-nitro-update`).

## Working demo (install on device and test OTA)

**Yes — install a release build on a physical device** to see the full flow: app runs → Check for update → Download & reload → app restarts on the new bundle → Confirm bundle.

**Step-by-step:** See **[DEMO.md](./DEMO.md)** for a generic flow, or **[DEMO-GITHUB-RELEASE.md](./DEMO-GITHUB-RELEASE.md)** for testing with the [Testing-OTA-builds-via-release](https://github.com/fullsnack-DEV/Testing-OTA-builds-via-release) repo:

1. Installing the app on your device (iOS/Android release).
2. Creating `version.txt` and a bundle zip.
3. Hosting them (e.g. local server + ngrok).
4. Setting the version and download URLs in the app.
5. Running the demo: Check → Download & reload → Confirm.

## Run (development)

From repo root:

```bash
npm run example:android   # or: npm run android --prefix example
npm run example:ios      # or: npm run ios --prefix example
```

From this directory:

```bash
npm run android
npm run ios
```

Start Metro first if needed: `npm start` (from root or example).

### Release build on iOS Simulator (match production / test OTA)

Daily development uses the **NitroUpdateExample** scheme (**Debug**). To run a **Release** build on the simulator (closer to TestFlight behavior):

1. **Install pods** (picks up Podfile settings for Release simulator): `cd ios && pod install && cd ..`
2. In Xcode: **Product → Scheme → NitroUpdateExample-Release**, pick a simulator, then **Product → Clean Build Folder** (⇧⌘K) and Run (⌘R).

Or from the example directory (use the Release scheme so the CLI matches Xcode):

```bash
npx react-native run-ios --scheme NitroUpdateExample-Release
```

Some CLI versions also accept `--configuration Release` instead of `--scheme`; if in doubt, use Xcode with **NitroUpdateExample-Release** selected.

The **NitroUpdateExample-Release** scheme is the same app target with **Run** set to the **Release** configuration. The Podfile sets `ONLY_ACTIVE_ARCH = NO` for **Release** pod targets so simulator slices build reliably.

**`@rpath/React.framework/React` on Release simulator:** React Native’s prebuilt `React.framework` comes from the **React-Core-prebuilt** XCFramework. CocoaPods’ `[CP] Embed Pods Frameworks` script only copies Hermes + ReactNativeDependencies, but the app still links `-framework React`, so the example app includes an extra build phase **“Embed React.framework (RN prebuilt)”** that copies `${PODS_XCFRAMEWORKS_BUILD_DIR}/React-Core-prebuilt/React.framework` into the app bundle. If you still see dyld errors, **Clean Build Folder** (⇧⌘K) and build again so the XCFramework intermediates exist before that phase runs.

## Integration check

From this directory:

```bash
npx react-native-nitro-update doctor
```

CI on the monorepo runs `doctor --json` here to ensure Podfile, native OTA loaders, and peers stay correct.

## What it does

- Shows **stored OTA version** (if any).
- **Check for update** — then **Download & reload** when an update is available.
- **Confirm bundle** — call after the app has restarted on the new bundle.
- **Rollback history** and **Rollback** to previous bundle.

Set `VERSION_CHECK_URL` and `DOWNLOAD_URL` in `App.tsx` to your hosted files (see [DEMO.md](./DEMO.md)).

**Create iOS OTA zip:** After making your changes in `App.tsx` (e.g. `BUILD_LABEL = '1.0.1'`), run from repo root:
```bash
./example/scripts/build-ota-zip-ios.sh
```
Output: `/tmp/ota-demo/bundle.zip`. Upload it (and `version.txt`) to your OTA repo.

## iOS bundle loader

The example’s iOS app loads the OTA bundle when present using the Swift-only **NitroUpdateBundleManager** (see `ios/NitroUpdateExample/AppDelegate.swift` and `NitroUpdateBundleManager.getStoredBundleURL()`). The Podfile adds `NitroUpdateBundleManager` from the same path as the library so the app does not import the main NitroUpdate pod in AppDelegate (avoids C++ in the app target).

## Android

Uses monorepo-friendly Gradle paths and `react-native-nitro-modules` 0.35.0. For release OTA, ensure your app loads the JS bundle from the path returned by `NitroUpdateBundleLoader.getStoredBundlePath(context)` when non-null.
