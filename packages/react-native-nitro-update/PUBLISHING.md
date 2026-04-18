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

## Publish from GitHub Actions (recommended if local publish fails)

If your machine gets auth errors but you have access to the GitHub repo and an npm token:

1. On [npmjs.com](https://www.npmjs.com/) → **Access Tokens** → create a **Granular Access Token** with **Read and write** for the package **`react-native-nitro-update`** (not only “read”).
2. In the GitHub repo → **Settings** → **Secrets and variables** → **Actions** → add **`NPM_TOKEN`** with that token.
3. Run workflow **Publish npm package** (Actions tab) with **dry run** unchecked.

Optional: run the workflow once with **dry run** checked to validate the tarball without uploading.

---

## Troubleshooting

- **`npm ERR! 404 Not Found - PUT https://registry.npmjs.org/react-native-nitro-update`**  
  The package [already exists on npm](https://www.npmjs.com/package/react-native-nitro-update). A **404 on PUT** usually means **you are not allowed to publish** this name (wrong account, read-only token, or missing collaborator), not that the name is available.

  **Fix:**

  1. Confirm you are a maintainer: `npm owner ls react-native-nitro-update` (you must appear in the list). If not, ask an existing owner to run:  
     `npm owner add <your-npm-username> react-native-nitro-update`
  2. Log in as the correct user: `npm whoami` then `npm login` if needed.
  3. If you use an **access token** (CI or `.npmrc`), it must be **granular** with **Read and write** (publish) on **`react-native-nitro-update`**, not a read-only or wrong-scope token.
  4. If your account has **2FA for publish**, pass a one-time code:  
     `npm publish --otp=123456`  
     (replace `123456` with your authenticator code).

- **“You must sign up for npm”**  
  Run `npm login` and complete sign-in (including 2FA).

- **“Package name already exists”**  
  Change `name` in `package.json` to a scoped name, e.g. `@your-username/react-native-nitro-update`, and use `npm publish --access public`.

- **“Cannot publish over existing version”**  
  Bump `version` in `package.json` and run `npm publish` again.

- **Missing `lib/` or type errors in published package**  
  Run `npm run typescript` inside `packages/react-native-nitro-update` before publishing. `prepublishOnly` does this automatically when you run `npm publish`.
