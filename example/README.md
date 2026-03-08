# Nitro OTA Example

Minimal example app for `react-native-nitro-update`. Uses the library from the monorepo (`file:../packages/react-native-nitro-update`).

## Run

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

## What it does

- Shows **stored OTA version** (if any).
- **Check for update** (placeholder URL).
- **Rollback history** and **Rollback** to previous bundle.

Extend with download, progress, and reload flows as needed.

## iOS bundle loader

The example’s iOS app loads the OTA bundle when present using the Swift-only **NitroUpdateBundleManager** (see `ios/NitroUpdateExample/AppDelegate.swift` and `NitroUpdateBundleManager.getStoredBundleURL()`). The Podfile adds `NitroUpdateBundleManager` from the same path as the library so the app does not import the main NitroUpdate pod in AppDelegate (avoids C++ in the app target).

## Android

Uses monorepo-friendly Gradle paths and `react-native-nitro-modules` 0.35.0. For release OTA, ensure your app loads the JS bundle from the path returned by `NitroUpdateBundleLoader.getStoredBundlePath(context)` when non-null.
