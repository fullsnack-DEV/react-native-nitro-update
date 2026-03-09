# Test OTA with your GitHub repo (Testing-OTA-builds-via-release)

Use [fullsnack-DEV/Testing-OTA-builds-via-release](https://github.com/fullsnack-DEV/Testing-OTA-builds-via-release) to host the version file and bundle zip. The example app uses the **githubOTA** helper (same pattern as [react-native-nitro-ota](https://github.com/riteshshukla04/react-native-nitro-ota)) with `useReleases: true`, so it points at the **latest release** assets.

Flow: **install release on device** → **make a visible change in the app** → **bundle and zip** → **put files in the repo (or Release)** → **in the app: Check → Download & reload** → you see the change.

---

## Step 1: Add version.txt and bundle.zip to the repo (first time)

The app expects:

- **Version URL:** `https://raw.githubusercontent.com/fullsnack-DEV/Testing-OTA-builds-via-release/main/version.txt`
- **Download URL:** `https://raw.githubusercontent.com/fullsnack-DEV/Testing-OTA-builds-via-release/main/bundle.zip`

So the repo must have **version.txt** and **bundle.zip** on the **main** branch (root is fine, or a folder like `ota/` — then use `.../main/ota/version.txt` in the app).

1. Clone the repo. If it’s empty, create **version.txt** with one line (e.g. `1.0.0`) and push (you can add a README in the same commit so the repo has content).
2. You’ll add **bundle.zip** in Step 5. For the first run you can push a placeholder or add the real zip after building in Step 4.

---

## Step 2: Build and install the app on your physical device (release)

You need a **release build** on a **physical device** so the app uses the bundled JS (not Metro). After the first OTA, the app will load from the downloaded bundle.

**iOS:**

```bash
cd example
npx react-native run-ios --mode Release --device "Your iPhone Name"
```

**Android:**

```bash
cd example
npx react-native run-android --mode=release
```

Open the app. You should see **Build: 1.0.0** and **Stored OTA version: none**. Leave the app installed; you’ll update it via OTA next.

---

## Step 3: Make a visible change (so you can confirm the OTA)

Change something in the example app so you can see the update after OTA, for example:

1. **Build label**  
   In **example/App.tsx** change:
   ```ts
   const BUILD_LABEL = '1.0.1'   // was 1.0.0
   ```
2. **Optional: color or UI**  
   - Change a color, e.g. `backgroundColor: '#2d7d32'` → `'#1565c0'`.
   - Or add a line of text, e.g. “OTA update worked!”.

Save the file. This will be the “new” bundle you serve as an OTA.

---

## Step 4: Build the JS bundle and create the zip (iOS only for now)

**Before you run this:** Make your changes in **example/App.tsx** (Step 3) so the zip contains the updated app — e.g. set `BUILD_LABEL = '1.0.1'` and optionally change a color or add "OTA worked!" text. Otherwise the zip will be the same as the app already on the device.

**Option A – Use the script (iOS only):**

From the repo root:

```bash
./example/scripts/build-ota-zip-ios.sh
```

This creates `/tmp/ota-demo/bundle.zip` with the iOS bundle. Upload that file (and your **version.txt**) to the repo.

**Option B – Run the commands yourself (iOS):**

```bash
cd example
mkdir -p /tmp/ota-demo
npx react-native bundle --platform ios --dev false --entry-file index.js \
  --bundle-output /tmp/ota-demo/index.ios.jsbundle \
  --assets-dest /tmp/ota-demo

cd /tmp/ota-demo
zip -r bundle.zip .
```

You now have **bundle.zip** containing `index.ios.jsbundle` (and assets if any). The library will find `index.ios.jsbundle` inside the zip.

---

## Step 5: Update version and upload zip to the repo (or Release)

- Bump the version that the app will see:
  - In **version.txt** in the repo, set the new version, e.g. `1.0.1` (must be “newer” than what the app had, or the app has no OTA yet so any version works).
- Upload **bundle.zip**:
  - **Option A – Files on main (recommended for this test):**  
    Commit and push **version.txt** and **bundle.zip** to the **main** branch of [Testing-OTA-builds-via-release](https://github.com/fullsnack-DEV/Testing-OTA-builds-via-release).  
    The example app is already configured to use:
    - `https://raw.githubusercontent.com/fullsnack-DEV/Testing-OTA-builds-via-release/main/version.txt`
    - `https://raw.githubusercontent.com/fullsnack-DEV/Testing-OTA-builds-via-release/main/bundle.zip`
  - **Option B – GitHub Release:**  
    Create a new Release (e.g. tag **v1.0.1**), attach **version.txt** and **bundle.zip** as assets. Then you must point the app at that release’s URLs once:
    - Version: `https://github.com/fullsnack-DEV/Testing-OTA-builds-via-release/releases/download/v1.0.1/version.txt`
    - Download: `https://github.com/fullsnack-DEV/Testing-OTA-builds-via-release/releases/download/v1.0.1/bundle.zip`  
    Update these in **example/App.tsx** (and rebuild the app) for each new release tag. For a single test, Option B is fine; for repeated tests without changing the app, Option A is easier.

---

## Step 6: Run the OTA flow on the device

1. Open the **same app** you installed in Step 2 (release build on device).
2. Tap **“Check for update”**.  
   You should see **“Update available”** (version from version.txt is newer than “none” or than the previous stored version).
3. Tap **“Download & reload”**.  
   The app downloads the zip, applies it, and restarts.
4. After restart you should see:
   - **Build: 1.0.1** (or whatever you set),
   - **Stored OTA version: 1.0.1**,
   - and any color/text change you made.
5. Tap **“Confirm bundle”** so the new bundle is marked good.

If you see the new build label and changes, the OTA from your GitHub repo (or release) is working.

---

## Checklist

| Step | What you do |
|------|-------------|
| 1 | Add **version.txt** (and later **bundle.zip**) to [Testing-OTA-builds-via-release](https://github.com/fullsnack-DEV/Testing-OTA-builds-via-release) on **main** (or use a Release and set URLs in the app). |
| 2 | Build **release** and install on a **physical device** (iOS or Android). |
| 3 | In the example app, change **BUILD_LABEL** (and optionally color/text). |
| 4 | Run `react-native bundle` for that platform, then **zip** the output as **bundle.zip**. |
| 5 | Set **version.txt** to the new version (e.g. `1.0.1`) and upload **bundle.zip** to the repo (or attach both to a Release). |
| 6 | On device: **Check for update** → **Download & reload** → after restart, **Confirm bundle** and confirm you see the new build and changes. |

---

## Using a Release tag instead of main

If you prefer to use **Releases** and tags (e.g. v1.0.0, v1.0.1):

1. Create a release (e.g. **v1.0.1**), upload **version.txt** and **bundle.zip** as assets.
2. In **example/App.tsx** set:
   ```ts
   const VERSION_CHECK_URL = 'https://github.com/fullsnack-DEV/Testing-OTA-builds-via-release/releases/download/v1.0.1/version.txt'
   const DOWNLOAD_URL = 'https://github.com/fullsnack-DEV/Testing-OTA-builds-via-release/releases/download/v1.0.1/bundle.zip'
   ```
3. Rebuild and reinstall the app once. After that, **Check for update** and **Download & reload** will use that release’s assets.

For the next OTA (e.g. v1.0.2), create a new release, upload new files, and update the two URLs in the app and rebuild again. For multiple OTAs without changing the app, keeping **version.txt** and **bundle.zip** on **main** and updating them there is simpler.

---

## Fix: bundle.zip 404 on main (physical build already uses these URLs)

If your **physical build** already uses the main-branch URLs and you see:

- `https://raw.githubusercontent.com/.../main/version.txt` → works (e.g. shows 1.0.1)
- `https://raw.githubusercontent.com/.../main/bundle.zip` → **404 Not Found**

then **bundle.zip** is missing from the repo’s **main** branch. Add it like this:

1. **Get a valid bundle.zip** (from this project):
   ```bash
   # From react-native-nitro-update repo root
   ./example/scripts/build-ota-zip-ios.sh
   ```
   This creates `/tmp/ota-demo/bundle.zip`. Or use `example/ota-demo/bundle.zip` if you already have one.

2. **Clone the OTA repo and add bundle.zip**:
   ```bash
   git clone https://github.com/fullsnack-DEV/Testing-OTA-builds-via-release.git
   cd Testing-OTA-builds-via-release
   cp /tmp/ota-demo/bundle.zip .    # or cp /path/to/react-native-nitro-update/example/ota-demo/bundle.zip .
   git add bundle.zip
   git commit -m "Add bundle.zip for OTA"
   git push origin main
   ```

3. **Verify:** Open  
   `https://raw.githubusercontent.com/fullsnack-DEV/Testing-OTA-builds-via-release/main/bundle.zip`  
   in a browser; it should download the file (no 404). Your physical build will then be able to download the OTA.
