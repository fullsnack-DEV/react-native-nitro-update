# Contributing to react-native-nitro-update

Thank you for considering contributing. Here’s how to get started.

## Development setup

1. **Clone and install**

   ```bash
   git clone https://github.com/fullsnack-DEV/react-native-nitro-update.git
   cd react-native-nitro-update
   npm install
   ```

2. **Run the example app**

   ```bash
   npm run example:ios
   # or
   npm run example:android
   ```

   Start Metro first if needed: `npm run start --prefix example`

3. **Package scripts** (from repo root)

   - `npm run specs --prefix packages/react-native-nitro-update` — regenerate Nitro specs (after changing `.nitro.ts` specs)
   - Typecheck and lint are in `packages/react-native-nitro-update`; run them from that directory or via your IDE

## Submitting changes

1. Open an **Issue** to discuss larger changes or API design.
2. **Fork** the repo and create a branch from `main`.
3. Make your changes; keep commits focused and messages clear.
4. Run typecheck and lint in `packages/react-native-nitro-update`.
5. Open a **Pull Request** against `main` with a short description and, if relevant, a link to the issue.

## Code and docs

- **Package source:** `packages/react-native-nitro-update/src`
- **Native code:** `packages/react-native-nitro-update/ios` and `packages/react-native-nitro-update/android`
- **Docs:** README and INTEGRATION.md in the package; update them if you change behavior or APIs.
- **Security:** Do not add real API keys, AWS credentials, or other secrets to source files, any `.md` file, or comments. Use `.env.ota` or environment variables only; keep `.env.ota` in `.gitignore`.

## Release checklist

Before publishing a new version:

1. **Update version**
   ```bash
   cd packages/react-native-nitro-update
   npm version patch  # or minor/major
   ```

2. **Run validation**
   ```bash
   npm run validate
   ```
   This checks:
   - All files in `package.json` "files" exist
   - No absolute/monorepo paths in code
   - TypeScript compiles
   - npm pack succeeds

3. **Test the package locally**
   ```bash
   npm pack
   # In a test RN app:
   npm install /path/to/react-native-nitro-update-x.x.x.tgz
   npx setup-ota doctor  # Should pass all checks
   ```

4. **Build and test example app**
   ```bash
   cd example
   npx pod-install
   npm run ios
   npm run android
   ```

5. **Publish**
   ```bash
   cd packages/react-native-nitro-update
   npm publish
   ```

6. **Tag release**
   ```bash
   git tag v$(node -p "require('./package.json').version")
   git push origin --tags
   ```

## Troubleshooting builds

Run the doctor command to diagnose issues:
```bash
npx setup-ota doctor
npx setup-ota doctor --json  # For CI
```

Common issues:
- **Swift compilation errors**: Add `NitroUpdatePodUtils.apply!(installer)` to Podfile
- **Missing OTA loading**: Wire `NitroUpdateBundleManager` (iOS) or `NitroUpdateBundleLoader` (Android)

## Questions

Open a [GitHub Issue](https://github.com/fullsnack-DEV/react-native-nitro-update/issues) for questions or ideas.
