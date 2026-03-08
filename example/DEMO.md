# Working OTA Demo – Step by Step

Yes — to see the **full OTA flow** (app loads bundled JS → you download an update → app reloads and runs the new bundle), you should **install a release build on a physical device** (or a release build on the simulator). Debug builds often load from Metro, so OTA is less visible.

Follow these steps to run a working demo.

---

## 1. Install the example app on your device

### Option A: Run a release build on a physical device (recommended)

**iOS (device):**

```bash
# From repo root
cd example
npx react-native run-ios --mode Release --device "Your iPhone Name"
```

Or in Xcode: open `example/ios/NitroUpdateExample.xcworkspace`, select your iPhone as target, set **Build Configuration** to **Release**, then Run.

**Android (device):**

```bash
# From repo root
cd example
npx react-native run-android --mode=release
```

Enable USB debugging and connect the device; the release APK will install.

### Option B: Run in debug first (to confirm the app works)

From repo root:

```bash
npm start
# In another terminal:
npm run example:ios    # or example:android
```

This uses the dev bundle from Metro. OTA still works: after you download and reload, the app will load the **OTA bundle** (not Metro) on the next launch.

---

## 2. Create the files to serve (version + bundle zip)

You need two things the app will fetch:

- A **version file** (plain text), e.g. `1.0.1`
- A **zip** containing the **JS bundle** (and optionally assets)

### 2.1 Version file

Create a file named `version.txt` with a single version string (e.g. `1.0.1`) and put it in the same folder you will serve (e.g. `/tmp/ota-demo/version.txt`).

### 2.2 Build the JS bundle and zip it

From the **example** directory:

**iOS bundle:**

```bash
cd example
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/ota-demo/index.ios.jsbundle --assets-dest /tmp/ota-demo
```

**Android bundle:**

```bash
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output /tmp/ota-demo/index.android.bundle --assets-dest /tmp/ota-demo
```

Then create the zip:

```bash
cd /tmp/ota-demo
zip -r bundle.zip .
# You now have version.txt (you create it) and bundle.zip
```

Put `version.txt` in the same folder (e.g. `/tmp/ota-demo/version.txt`), then serve that folder (see step 3).

---

## 3. Host the version file and zip

The app must reach them over HTTP(S). Options:

### Option A: Local server on your machine (device and machine on same Wi‑Fi)

```bash
cd /tmp/ota-demo
npx serve -l 3000
```

Note your machine’s IP (e.g. `192.168.1.10`). Then:

- Version URL: `http://192.168.1.10:3000/version.txt`
- Download URL: `http://192.168.1.10:3000/bundle.zip`

**iOS:** By default iOS blocks non-HTTPS. Use `http://` only if your app has App Transport Security disabled for that host, or use HTTPS (e.g. ngrok, or a real server).

**Android:** Usually allows `http://` to a local IP.

### Option B: ngrok (HTTPS, good for iOS)

```bash
npx serve -l 3000
# In another terminal:
ngrok http 3000
```

Use the `https://….ngrok.io` URLs, e.g.:

- Version URL: `https://xxxx.ngrok.io/version.txt`
- Download URL: `https://xxxx.ngrok.io/bundle.zip`

### Option C: GitHub, CDN, or any server

Upload `version.txt` and `bundle.zip` and use their URLs. Same idea as in the main README: host anywhere.

---

## 4. Point the example app at your URLs

Edit **example/App.tsx** and set:

```ts
const VERSION_CHECK_URL = 'https://your-server.com/version.txt'  // or http://IP:3000/version.txt
const DOWNLOAD_URL = 'https://your-server.com/bundle.zip'        // or http://IP:3000/bundle.zip
```

Rebuild and reinstall the app (or, if you’re in dev, reload so the new URLs are used).

---

## 5. Run the demo on the device

1. **Open the app** on your device (release build recommended).
2. **Tap “Check for update”.**  
   - If the version you put in `version.txt` is “newer” than what the app has (or no OTA yet), you should see **“Update available”**.
3. **Tap “Download & reload”.**  
   - The app downloads the zip, applies the bundle, and restarts. After restart it runs the **new** bundle.
4. **Tap “Confirm bundle”.**  
   - Tells the library the new bundle is good (so it won’t roll back on next launch).
5. **Optional:** Change `version.txt` to a newer string, serve it again, then **Check for update** again to see “Update available” and repeat.

---

## 6. Rollback (optional)

- Tap **“Rollback”** to go back to the previous bundle (or the original one) and reload.
- Use **“Rollback history”** to see what was rolled back.

---

## Quick checklist

| Step | What to do |
|------|------------|
| 1 | Install the example app on a **physical device** (release build recommended). |
| 2 | Create `version.txt` and build the JS bundle, then zip it as `bundle.zip`. |
| 3 | Host both files (e.g. `npx serve` + ngrok, or your own server). |
| 4 | Set `VERSION_CHECK_URL` and `DOWNLOAD_URL` in `example/App.tsx` to those URLs. |
| 5 | In the app: **Check for update** → **Download & reload** → after restart, **Confirm bundle**. |

If anything fails, check: device and server on same network (for local IP), or use HTTPS (e.g. ngrok) for iOS; and that the zip contains the bundle file (e.g. `index.ios.jsbundle` or `index.android.bundle`).
