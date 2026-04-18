# Changelog

## Unreleased

- `downloadUpdate` accepts optional `remoteVersion` so single-JSON OTA (`checkAndDownloadFromConfig`) stores the correct OTA label without relying on a prior `checkForUpdate` (fixes stored version `"unknown"` on that path). Native validates `+ota` compatibility and blacklist when `remoteVersion` is set.
- Docs: version contract (bump every release, two-URL ordering, `+ota` prefix, CDN caching).

## 0.0.9 - 2026-03-19

- ObjC AppDelegate support
- Automatic pending-validation rollback in loader APIs
- Nitro 0.35 compatibility
