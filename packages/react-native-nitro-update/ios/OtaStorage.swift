import Foundation

/// Keys and paths for OTA bundle storage (used by HybridBundleUpdater and NitroUpdateBundleLoader).
enum OtaStorage {
  private static let defaults = UserDefaults.standard
  private static let suite = "com.nitroupdate"
  
  static var userDefaults: UserDefaults {
    defaults
  }
  
  static let versionKey = "nitroupdate.version"
  static let bundlePathKey = "nitroupdate.bundlePath"
  static let pendingValidationKey = "nitroupdate.pendingValidation"
  static let blacklistKey = "nitroupdate.blacklist"
  static let rollbackHistoryKey = "nitroupdate.rollbackHistory"
  static let previousVersionKey = "nitroupdate.previousVersion"
  static let previousBundlePathKey = "nitroupdate.previousBundlePath"
  static let lastCheckedRemoteVersionKey = "nitroupdate.lastCheckedRemoteVersion"
  static let bgVersionCheckUrlKey = "nitroupdate.bgVersionCheckUrl"
  static let bgDownloadUrlKey = "nitroupdate.bgDownloadUrl"
  static let bgBundlePathInZipKey = "nitroupdate.bgBundlePathInZip"
  static let bgIntervalSecondsKey = "nitroupdate.bgIntervalSeconds"

  static var bundlesDirectory: URL {
    let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
    let dir = appSupport.appendingPathComponent("NitroUpdate/bundles", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }
  
  static func getStoredVersion() -> String? {
    defaults.string(forKey: versionKey)
  }
  
  static func setStoredVersion(_ value: String?) {
    if let v = value { defaults.set(v, forKey: versionKey) }
    else { defaults.removeObject(forKey: versionKey) }
  }
  
  static func getStoredBundlePath() -> String? {
    defaults.string(forKey: bundlePathKey)
  }
  
  static func setStoredBundlePath(_ value: String?) {
    if let v = value { defaults.set(v, forKey: bundlePathKey) }
    else { defaults.removeObject(forKey: bundlePathKey) }
  }
  
  static var isPendingValidation: Bool {
    get { defaults.bool(forKey: pendingValidationKey) }
    set { defaults.set(newValue, forKey: pendingValidationKey) }
  }
  
  static var lastCheckedRemoteVersion: String? {
    get { defaults.string(forKey: lastCheckedRemoteVersionKey) }
    set {
      if let v = newValue { defaults.set(v, forKey: lastCheckedRemoteVersionKey) }
      else { defaults.removeObject(forKey: lastCheckedRemoteVersionKey) }
    }
  }
  
  static func getBlacklist() -> [String] {
    guard let data = defaults.data(forKey: blacklistKey),
          let arr = try? JSONDecoder().decode([String].self, from: data) else { return [] }
    return arr
  }
  
  static func setBlacklist(_ list: [String]) {
    guard let data = try? JSONEncoder().encode(list) else { return }
    defaults.set(data, forKey: blacklistKey)
  }
  
  static func getRollbackHistory() -> [[String: String]] {
    guard let data = defaults.data(forKey: rollbackHistoryKey),
          let arr = try? JSONDecoder().decode([[String: String]].self, from: data) else { return [] }
    return arr
  }
  
  static func appendRollbackRecord(fromVersion: String, toVersion: String, reason: String) {
    var history = getRollbackHistory()
    history.append([
      "timestamp": String(Int(Date().timeIntervalSince1970 * 1000)),
      "fromVersion": fromVersion,
      "toVersion": toVersion,
      "reason": reason,
    ])
    if let data = try? JSONEncoder().encode(history) {
      defaults.set(data, forKey: rollbackHistoryKey)
    }
  }
  
  static func savePreviousForRollback() {
    if let v = getStoredVersion() { defaults.set(v, forKey: previousVersionKey) }
    if let p = getStoredBundlePath() { defaults.set(p, forKey: previousBundlePathKey) }
  }
  
  static func getPreviousVersion() -> String? { defaults.string(forKey: previousVersionKey) }
  static func getPreviousBundlePath() -> String? { defaults.string(forKey: previousBundlePathKey) }

  static func getBgVersionCheckUrl() -> String? { defaults.string(forKey: bgVersionCheckUrlKey) }
  static func setBgVersionCheckUrl(_ value: String?) {
    if let v = value { defaults.set(v, forKey: bgVersionCheckUrlKey) } else { defaults.removeObject(forKey: bgVersionCheckUrlKey) }
  }
  static func getBgDownloadUrl() -> String? { defaults.string(forKey: bgDownloadUrlKey) }
  static func setBgDownloadUrl(_ value: String?) {
    if let v = value { defaults.set(v, forKey: bgDownloadUrlKey) } else { defaults.removeObject(forKey: bgDownloadUrlKey) }
  }
  static func getBgBundlePathInZip() -> String? { defaults.string(forKey: bgBundlePathInZipKey) }
  static func setBgBundlePathInZip(_ value: String?) {
    if let v = value { defaults.set(v, forKey: bgBundlePathInZipKey) } else { defaults.removeObject(forKey: bgBundlePathInZipKey) }
  }
  static var bgIntervalSeconds: TimeInterval {
    get { defaults.double(forKey: bgIntervalSecondsKey) > 0 ? defaults.double(forKey: bgIntervalSecondsKey) : 3600 }
    set { defaults.set(newValue, forKey: bgIntervalSecondsKey) }
  }

  static func clearPrevious() {
    defaults.removeObject(forKey: previousVersionKey)
    defaults.removeObject(forKey: previousBundlePathKey)
  }
}
