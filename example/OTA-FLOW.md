# OTA Update Flow (Physical Build → Release → User)

This describes exactly when the app checks for updates, downloads in the background, and when the new bundle is applied.

---

## 1. You (developer) do this

| Step | What you do |
|------|-------------|
| 1 | **Ship a physical (release) build** of the app, e.g. with `BUILD_LABEL = '1.0.6'` and embedded `main.jsbundle`. |
| 2 | When you have a new JS version (e.g. 1.0.7): update `BUILD_LABEL` in `App.tsx`, run `./example/scripts/build-ota-zip-ios.sh` to create `version.txt` (content: `1.0.7`) and `bundle.zip`. |
| 3 | Create a **new GitHub release** (or edit latest) and attach `version.txt` and `bundle.zip` as release assets. |

The app is configured to use `releases/latest/download/version.txt` and `releases/latest/download/bundle.zip`, so **one app build** can receive all future OTAs until you ship a new native build.

---

## 2. What happens when the user has the physical build

The user has your **release build** installed (e.g. 1.0.6 embedded). No dev server, no Metro.

### Step-by-step flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  USER OPENS APP                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Native (AppDelegate) decides which bundle to load:                          │
│  • RELEASE: If an OTA bundle exists on disk → load it.                       │
│             Else → load embedded main.jsbundle.                               │
│  • DEBUG:   Always load from Metro (dev server).                             │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  JS app runs. On mount:                                                     │
│  1. confirmBundle() — marks current bundle as “healthy” (for crash rollback).│
│  2. InteractionManager.runAfterInteractions() + 2s delay.                    │
│     (Keeps startup smooth; no heavy work during first paint.)                │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  CHECK: GET version.txt from GitHub (releases/latest/download/version.txt). │
│  Compare with stored OTA version (or “none” if first launch).                │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ├── No update (same or no version) ──► Show “up to date”, done.
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  DOWNLOAD (in background relative to UI):                                   │
│  GET bundle.zip from GitHub → save to temp → unzip → store new bundle        │
│  and version on disk. User can keep using the app while this runs.           │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  APPLY (release build only):                                                │
│  reloadApp() → native exit(0) → process ends.                               │
│  User (or OS) opens the app again → next launch loads the NEW bundle from    │
│  disk (AppDelegate returns OTA bundle URL).                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### When does the OTA “apply”?

| Moment | What happens |
|--------|-------------------------------|
| **During use** | Update is **downloaded** in the background (async). UI stays responsive. |
| **After download** | In **release**, the app calls `reloadApp()` and exits. |
| **Next open** | User taps the app again (or system reopens it). That **cold start** loads the **new** OTA bundle from disk. So the OTA is **applied on the next launch** after the download finished. |

So: **download while using the app → apply when the app is restarted** (we trigger that restart right after download in release).

---

## 3. Summary table

| You do | User with physical build |
|--------|--------------------------|
| Ship release build with embedded 1.0.6 | Has app installed, opens it. |
| Add release with version.txt=1.0.7 + bundle.zip | App loads 1.0.6 (embedded or previous OTA). |
| — | After ~2s, app fetches version.txt, sees 1.0.7. |
| — | App downloads bundle.zip in background. |
| — | When done, app restarts (reloadApp). |
| — | User opens app again → 1.0.7 runs (loaded from OTA on disk). |

---

## 4. Optional: apply on next cold start only

If you **don’t** want to restart the app right after download (e.g. to avoid interrupting the user), you can **not** call `reloadApp()` after `downloadUpdate()`. Then:

- The new bundle is still **saved** on disk.
- It will be **used the next time** the user cold-starts the app (e.g. next day).

In the current example we **do** call `reloadApp()` in release so the new version is used as soon as the download finishes (after the restart). You can change that by removing the `reloadApp()` call and relying on “apply on next cold start” instead.
