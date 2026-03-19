import Foundation

/// Standalone bundle manager for NitroUpdate — no C++/Nitrogen dependencies.
/// Use this in AppDelegate so the app does not pull in C++ headers.
///
/// Storage keys must match OtaStorage in the main NitroUpdate pod so the
/// HybridBundleUpdater and the app read/write the same path.
///
/// Usage in AppDelegate:
///   import NitroUpdateBundleManager
///   #if !DEBUG
///   if let otaURL = NitroUpdateBundleManager.getStoredBundleURL() { return otaURL }
///   #endif
///   return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
public enum NitroUpdateBundleManager {
  private static let defaults = UserDefaults.standard

  private static let bundlePathKey = "nitroupdate.bundlePath"
  private static let versionKey = "nitroupdate.version"
  private static let pendingValidationKey = "nitroupdate.pendingValidation"
  private static let previousBundlePathKey = "nitroupdate.previousBundlePath"
  private static let previousVersionKey = "nitroupdate.previousVersion"
  private static let launchAttemptsKey = "nitroupdate.launchAttempts"

  private static func recoverIfPendingBundleLikelyCrashed() {
    let pending = defaults.bool(forKey: pendingValidationKey)
    var attempts = defaults.integer(forKey: launchAttemptsKey)

    guard pending else {
      if attempts != 0 {
        defaults.set(0, forKey: launchAttemptsKey)
      }
      return
    }

    attempts += 1
    defaults.set(attempts, forKey: launchAttemptsKey)

    guard attempts >= 2 else { return }

    let prevPath = defaults.string(forKey: previousBundlePathKey)
    let prevVersion = defaults.string(forKey: previousVersionKey)

    if let prevPath, !prevPath.isEmpty, FileManager.default.fileExists(atPath: prevPath) {
      defaults.set(prevPath, forKey: bundlePathKey)
      if let prevVersion, !prevVersion.isEmpty {
        defaults.set(prevVersion, forKey: versionKey)
      } else {
        defaults.removeObject(forKey: versionKey)
      }
    } else {
      defaults.removeObject(forKey: bundlePathKey)
      defaults.removeObject(forKey: versionKey)
    }

    defaults.set(false, forKey: pendingValidationKey)
    defaults.removeObject(forKey: previousBundlePathKey)
    defaults.removeObject(forKey: previousVersionKey)
    defaults.set(0, forKey: launchAttemptsKey)
  }

  /// Returns the stored OTA bundle URL if present and the file exists; otherwise nil.
  public static func getStoredBundleURL() -> URL? {
    recoverIfPendingBundleLikelyCrashed()
    guard let path = defaults.string(forKey: bundlePathKey),
          !path.isEmpty,
          FileManager.default.fileExists(atPath: path) else {
      return nil
    }
    return URL(fileURLWithPath: path)
  }

  /// Returns the stored bundle path string if present; otherwise nil.
  public static func getStoredBundlePath() -> String? {
    recoverIfPendingBundleLikelyCrashed()
    guard let path = defaults.string(forKey: bundlePathKey),
          !path.isEmpty,
          FileManager.default.fileExists(atPath: path) else {
      return nil
    }
    return path
  }
}
