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
- **Single install** — `npm install react-native-nitro-update` (brings in `react-native-nitro-modules` automatically)

---

## Install

```bash
npm install react-native-nitro-update
```

Then wire native (iOS AppDelegate + Android bundle loader) and add a short JS snippet to check for updates on launch. Full steps: **[packages/react-native-nitro-update/README.md](./packages/react-native-nitro-update/README.md)** and **[INTEGRATION guide](./packages/react-native-nitro-update/INTEGRATION.md)**.

---

## Repository structure

| Path | Description |
|------|-------------|
| **[packages/react-native-nitro-update](./packages/react-native-nitro-update)** | The published npm package: source, native iOS/Android, docs |
| **[example](./example)** | Example React Native app with OTA flow and GitHub Releases |

---

## Docs & links

- **Full API and native setup:** [packages/react-native-nitro-update/README.md](./packages/react-native-nitro-update/README.md)
- **Use in your own app:** [packages/react-native-nitro-update/INTEGRATION.md](./packages/react-native-nitro-update/INTEGRATION.md)
- **Publish to npm:** [packages/react-native-nitro-update/PUBLISHING.md](./packages/react-native-nitro-update/PUBLISHING.md)
- **Package on npm:** [npmjs.com/package/react-native-nitro-update](https://www.npmjs.com/package/react-native-nitro-update)

---

## License

MIT — see [LICENSE](./LICENSE).
