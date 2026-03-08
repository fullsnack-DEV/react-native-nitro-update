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
  private static let bundlePathKey = "nitroupdate.bundlePath"

  /// Returns the stored OTA bundle URL if present and the file exists; otherwise nil.
  public static func getStoredBundleURL() -> URL? {
    guard let path = UserDefaults.standard.string(forKey: bundlePathKey),
          !path.isEmpty,
          FileManager.default.fileExists(atPath: path) else {
      return nil
    }
    return URL(fileURLWithPath: path)
  }

  /// Returns the stored bundle path string if present; otherwise nil.
  public static func getStoredBundlePath() -> String? {
    guard let path = UserDefaults.standard.string(forKey: bundlePathKey),
          !path.isEmpty,
          FileManager.default.fileExists(atPath: path) else {
      return nil
    }
    return path
  }
}
