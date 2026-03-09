# Publishing react-native-nitro-update to npm

Step-by-step guide to publish this package to the public npm registry so others can `npm install react-native-nitro-update`.

---

## Prerequisites

1. **npm account**  
   Sign up at [https://www.npmjs.com/signup](https://www.npmjs.com/signup) if you don’t have one.

2. **Two-factor authentication (2FA)**  
   npm requires 2FA for publish. Enable it: [https://www.npmjs.com/settings/~/tfa](https://www.npmjs.com/settings/~/tfa).

3. **Package name**  
   Check if `react-native-nitro-update` is free:  
   [https://www.npmjs.com/package/react-native-nitro-update](https://www.npmjs.com/package/react-native-nitro-update)  
   If it’s taken, use a scoped name in `package.json`, e.g. `"name": "@your-username/react-native-nitro-update"`. Then users install with `npm install @your-username/react-native-nitro-update`.

---

## One-time setup

### 1. Log in to npm (terminal)

```bash
npm login
```

- Username: your npm username  
- Password: your npm password  
- Email: your email  
- OTP: one-time code from your 2FA app  

You only need to do this once per machine (or until you run `npm logout`).

### 2. Set author (optional)

In `packages/react-native-nitro-update/package.json`, set `author` if you want it on the npm page:

```json
"author": "Your Name <you@example.com>",
```

Or leave it empty.

---

## Before each publish

From the **repo root**:

1. **Build the package**  
   Ensures `lib/` is up to date (TypeScript). `prepublishOnly` runs this automatically on `npm publish`; you can run it yourself:

   ```bash
   cd packages/react-native-nitro-update && npm run typescript && cd ../..
   ```

2. **Bump version**  
   In `packages/react-native-nitro-update/package.json`, update `version`:

   - Patch (bug fixes): `0.0.1` → `0.0.2`
   - Minor (new features): `0.0.1` → `0.1.0`
   - Major (breaking): `0.0.1` → `1.0.0`

   Or use npm from the **package** directory:

   ```bash
   cd packages/react-native-nitro-update
   npm version patch   # 0.0.1 -> 0.0.2
   # or
   npm version minor   # 0.0.1 -> 0.1.0
   ```

   This updates `package.json` and (if the repo is git) creates a git tag.

3. **Commit and push** (recommended)

   ```bash
   git add packages/react-native-nitro-update/package.json
   git commit -m "chore: release v0.0.2"
   git push
   ```

---

## Publish

From the **package** directory (not repo root):

```bash
cd packages/react-native-nitro-update
npm publish
```

- **First time:** Publishes the package to npm. If the name is taken, you’ll get an error; switch to a scoped name (e.g. `@your-username/react-native-nitro-update`) and try again.
- **Later:** Use a new version each time (see “Bump version” above). You cannot republish the same version.

**Publish as public (if using a scope):**

```bash
npm publish --access public
```

Required when the package name is scoped (e.g. `@fullsnack-DEV/react-native-nitro-update`).

---

## After publish

- Package page: `https://www.npmjs.com/package/react-native-nitro-update`  
- Install: `npm install react-native-nitro-update`

---

## Checklist (summary)

| Step | Command / action |
|------|-------------------|
| 1 | npmjs.com account + 2FA |
| 2 | `npm login` (once per machine) |
| 3 | Check name: [npmjs.com/package/react-native-nitro-update](https://www.npmjs.com/package/react-native-nitro-update) |
| 4 | Bump version in `package.json` or `npm version patch` |
| 5 | `cd packages/react-native-nitro-update && npm publish` (add `--access public` if scoped) |

---

## Troubleshooting

- **“You must sign up for npm”**  
  Run `npm login` and complete sign-in (including 2FA).

- **“Package name already exists”**  
  Change `name` in `package.json` to a scoped name, e.g. `@your-username/react-native-nitro-update`, and use `npm publish --access public`.

- **“Cannot publish over existing version”**  
  Bump `version` in `package.json` and run `npm publish` again.

- **Missing `lib/` or type errors in published package**  
  Run `npm run typescript` inside `packages/react-native-nitro-update` before publishing. `prepublishOnly` does this automatically when you run `npm publish`.
