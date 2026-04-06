# react-native-nitro-update

[![npm version](https://img.shields.io/npm/v/react-native-nitro-update.svg)](https://www.npmjs.com/package/react-native-nitro-update)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**High-performance Over-The-Air (OTA) updates for React Native** — powered by [Nitro](https://github.com/nitro-render/nitro) and JSI. Ship JavaScript bundle updates without going through the App Store or Play Store.

---

## Features

- **Native performance** — Check, download, and apply updates via Nitro/JSI; minimal JS-thread work
- **Background updates** — Download in the background; new bundle applies on next app launch (no forced restart)
- **Server-agnostic** — Use GitHub Releases, your own CDN, S3, or any host that serves a version file + zip
- **Rollback & safety** — Roll back to the previous bundle, blacklist bad versions, optional crash guard
- **Nitro / JSI** — Ship with `react-native-nitro-update` plus an explicit **`react-native-nitro-modules`** install (peer dependency; npm does not auto-install peers)

---

## Install

```bash
npm install react-native-nitro-update react-native-nitro-modules
```

Then wire native (iOS Podfile + AppDelegate, Android bundle path for your RN version) and add a short JS snippet. Validate with:

```bash
npx react-native-nitro-update doctor
```

Full steps: **[packages/react-native-nitro-update/README.md](./packages/react-native-nitro-update/README.md)** and **[INTEGRATION.md](./packages/react-native-nitro-update/INTEGRATION.md)**. Canonical native examples live under **[example/](example/)** (see INTEGRATION “Golden path” links).

---

## Add to your app (from npm)

Use this checklist when integrating [react-native-nitro-update](https://www.npmjs.com/package/react-native-nitro-update) into **any** React Native project (not this monorepo’s `example/`, which uses a workspace path).

| Step | Action |
|------|--------|
| 1 | `npm install react-native-nitro-update react-native-nitro-modules` |
| 2 | **iOS:** Add `pod 'NitroUpdateBundleManager', :path => '../node_modules/react-native-nitro-update'` and `NitroUpdatePodUtils.apply!(installer)` in `Podfile` — see [INTEGRATION.md §2](packages/react-native-nitro-update/INTEGRATION.md) |
| 3 | **iOS:** In release, `bundleURL()` / `sourceURL` must prefer `NitroUpdateBundleManager.getStoredBundleURL()` — [golden path template](https://github.com/fullsnack-DEV/react-native-nitro-update/blob/main/example/ios/NitroUpdateExample/AppDelegate.swift) |
| 4 | **Android (RN 0.76+):** Pass `jsBundleFilePath = NitroUpdateBundleLoader.getStoredBundlePath(this)` into `getDefaultReactHost` — [template](https://github.com/fullsnack-DEV/react-native-nitro-update/blob/main/example/android/app/src/main/java/com/nitroupdateexample/MainApplication.kt) |
| 5 | **JS:** After launch, `checkForUpdate(versionUrl)` then `downloadUpdate(downloadUrl)`; call `confirmBundle()` when the new bundle is healthy — [INTEGRATION.md §4](packages/react-native-nitro-update/INTEGRATION.md) |
| 6 | **Host** `version.txt` + `bundle.zip`; build artifacts with `npx react-native-nitro-update build --platform ios` (or `both`) |
| 7 | **Validate:** `npx react-native-nitro-update doctor` — optional `npx react-native-nitro-update setup` (wizard) or `npx react-native-nitro-update bootstrap` (`OTA_BOOTSTRAP.md`) |

Details, ObjC, older Android hosts, GitHub Releases, S3, manifests, and rollback: **[INTEGRATION.md](packages/react-native-nitro-update/INTEGRATION.md)** and the [package README](packages/react-native-nitro-update/README.md).

---

## Repository structure

| Path | Description |
|------|-------------|
| **[packages/react-native-nitro-update](./packages/react-native-nitro-update)** | The published npm package: source, native iOS/Android, docs |
| **[example](./example)** | Example React Native app with OTA flow and GitHub Releases |

---

## Docs & links

- **Install from npm:** [npmjs.com/package/react-native-nitro-update](https://www.npmjs.com/package/react-native-nitro-update) — see **Add to your app (from npm)** above for the full checklist
- **Full API and native setup:** [packages/react-native-nitro-update/README.md](./packages/react-native-nitro-update/README.md)
- **Step-by-step integration:** [packages/react-native-nitro-update/INTEGRATION.md](./packages/react-native-nitro-update/INTEGRATION.md)
- **Publish to npm:** [packages/react-native-nitro-update/PUBLISHING.md](./packages/react-native-nitro-update/PUBLISHING.md)

---

## License

MIT — see [LICENSE](./LICENSE).
