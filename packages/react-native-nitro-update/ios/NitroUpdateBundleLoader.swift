import Foundation

/// Use this from AppDelegate to load the OTA bundle when present.
/// Returns the stored bundle URL if an OTA update is active, otherwise nil (use default bundle).
public enum NitroUpdateBundleLoader {
  public static func getStoredBundleURL() -> URL? {
    guard let path = OtaStorage.getStoredBundlePath(),
          FileManager.default.fileExists(atPath: path) else {
      return nil
    }
    return URL(fileURLWithPath: path)
  }
}
