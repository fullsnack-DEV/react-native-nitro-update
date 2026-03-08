import Foundation
import NitroModules
import CryptoKit
import Compression
#if canImport(BackgroundTasks)
import BackgroundTasks
#endif

private func unwrapOptionalString(_ v: Variant_NullType_String?) -> String? {
  guard let v = v else { return nil }
  if case .second(let s) = v { return s }
  return nil
}

private func wrapOptionalString(_ s: String?) -> Variant_NullType_String {
  guard let s = s else { return .first(NullType.null) }
  return .second(s)
}

public final class HybridBundleUpdater: HybridBundleUpdaterSpec_base, HybridBundleUpdaterSpec_protocol {
  
  public override init() {
    super.init()
  }
  
  public func checkForUpdate(versionCheckUrl: String) throws -> Promise<Bool> {
    Promise.async {
      guard let url = URL(string: versionCheckUrl) else { return false }
      let (data, _) = try await URLSession.shared.data(from: url)
      let remoteVersion = String(data: data, encoding: .utf8)?
        .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
      OtaStorage.lastCheckedRemoteVersion = remoteVersion.isEmpty ? nil : remoteVersion
      let stored = OtaStorage.getStoredVersion()
      if OtaStorage.getBlacklist().contains(remoteVersion) {
        return false
      }
      if stored == nil { return !remoteVersion.isEmpty }
      return remoteVersion != stored
    }
  }
  
  public func downloadUpdate(
    downloadUrl: String,
    bundlePathInZip: Variant_NullType_String?,
    checksum: Variant_NullType_String?
  ) throws -> Promise<Void> {
    let bundleSubpath = unwrapOptionalString(bundlePathInZip)
    let expectedChecksum = unwrapOptionalString(checksum)
    
    return Promise.async {
      guard let url = URL(string: downloadUrl) else {
        throw NSError(domain: "NitroUpdate", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid download URL"])
      }
      OtaStorage.savePreviousForRollback()
      
      let (tempZipLocation, _) = try await URLSession.shared.download(from: url)
      let zipPath = tempZipLocation.path
      defer { try? FileManager.default.removeItem(at: tempZipLocation) }
      
      let unzipDir = OtaStorage.bundlesDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
      try FileManager.default.createDirectory(at: unzipDir, withIntermediateDirectories: true)
      
      try unzipFile(at: zipPath, to: unzipDir.path)
      
      let bundlePath: String
      if let subpath = bundleSubpath, !subpath.isEmpty {
        bundlePath = unzipDir.appendingPathComponent(subpath).path
      } else {
        guard let found = findBundleFile(in: unzipDir) else {
          throw NSError(domain: "NitroUpdate", code: 2, userInfo: [NSLocalizedDescriptionKey: "No bundle file found in zip"])
        }
        bundlePath = found.path
      }
      
      if let expected = expectedChecksum, !expected.isEmpty {
        let data = try Data(contentsOf: URL(fileURLWithPath: bundlePath))
        let computed = sha256Hex(data)
        if computed.lowercased() != expected.lowercased() {
          try? FileManager.default.removeItem(at: unzipDir)
          throw NSError(domain: "NitroUpdate", code: 3, userInfo: [NSLocalizedDescriptionKey: "Checksum mismatch"])
        }
      }
      
      let version = OtaStorage.lastCheckedRemoteVersion ?? "unknown"
      OtaStorage.setStoredVersion(version)
      OtaStorage.setStoredBundlePath(bundlePath)
      OtaStorage.isPendingValidation = true
    }
  }
  
  public func getStoredVersion() throws -> Variant_NullType_String {
    wrapOptionalString(OtaStorage.getStoredVersion())
  }
  
  public func getStoredBundlePath() throws -> Variant_NullType_String {
    wrapOptionalString(OtaStorage.getStoredBundlePath())
  }
  
  public func reloadApp() throws {
    DispatchQueue.main.async {
      exit(0)
    }
  }
  
  public func confirmBundle() throws {
    OtaStorage.isPendingValidation = false
    OtaStorage.clearPrevious()
  }
  
  public func rollback() throws -> Promise<Bool> {
    Promise.async {
      guard let prevPath = OtaStorage.getPreviousBundlePath(),
            let prevVersion = OtaStorage.getPreviousVersion() else {
        return false
      }
      let fromVersion = OtaStorage.getStoredVersion() ?? "unknown"
      OtaStorage.setStoredVersion(prevVersion)
      OtaStorage.setStoredBundlePath(prevPath)
      OtaStorage.isPendingValidation = false
      OtaStorage.appendRollbackRecord(fromVersion: fromVersion, toVersion: prevVersion, reason: "manual")
      OtaStorage.clearPrevious()
      return true
    }
  }
  
  public func markBundleBad(reason: String) throws -> Promise<Void> {
    Promise.async {
      let fromVersion = OtaStorage.getStoredVersion() ?? "unknown"
      var blacklist = OtaStorage.getBlacklist()
      if !blacklist.contains(fromVersion) {
        blacklist.append(fromVersion)
        OtaStorage.setBlacklist(blacklist)
      }
      if let prevPath = OtaStorage.getPreviousBundlePath(), let prevVersion = OtaStorage.getPreviousVersion() {
        OtaStorage.setStoredVersion(prevVersion)
        OtaStorage.setStoredBundlePath(prevPath)
      } else {
        OtaStorage.setStoredVersion(nil)
        OtaStorage.setStoredBundlePath(nil)
      }
      OtaStorage.isPendingValidation = false
      OtaStorage.appendRollbackRecord(fromVersion: fromVersion, toVersion: OtaStorage.getStoredVersion() ?? "original", reason: reason)
      OtaStorage.clearPrevious()
    }
  }
  
  public func getBlacklist() throws -> Promise<String> {
    Promise.async {
      let list = OtaStorage.getBlacklist()
      guard let data = try? JSONEncoder().encode(list) else { return "[]" }
      return String(data: data, encoding: .utf8) ?? "[]"
    }
  }
  
  public func getRollbackHistory() throws -> Promise<String> {
    Promise.async {
      let history = OtaStorage.getRollbackHistory()
      guard let data = try? JSONSerialization.data(withJSONObject: history) else { return "[]" }
      return String(data: data, encoding: .utf8) ?? "[]"
    }
  }
  
  public func scheduleBackgroundCheck(
    versionCheckUrl: String,
    downloadUrl: Variant_NullType_String?,
    intervalSeconds: Double
  ) throws {
    OtaStorage.setBgVersionCheckUrl(versionCheckUrl)
    OtaStorage.setBgDownloadUrl(unwrapOptionalString(downloadUrl))
    OtaStorage.setBgBundlePathInZip(nil)
    OtaStorage.bgIntervalSeconds = intervalSeconds
    #if canImport(BackgroundTasks) && !os(macOS)
    Self.registerAndScheduleBackgroundCheck()
    #endif
  }
}

#if canImport(BackgroundTasks) && !os(macOS)
private let kBackgroundTaskIdentifier = "com.nitroupdate.backgroundcheck"

extension HybridBundleUpdater {
  static var backgroundCheckRegistered = false

  static func registerAndScheduleBackgroundCheck() {
    if backgroundCheckRegistered { return }
    backgroundCheckRegistered = true
    BGTaskScheduler.shared.register(forTaskWithIdentifier: kBackgroundTaskIdentifier, using: nil) { task in
      handleBackgroundCheck(task: task as! BGAppRefreshTask)
    }
    submitBackgroundCheckRequest()
  }

  static func submitBackgroundCheckRequest() {
    guard OtaStorage.getBgVersionCheckUrl() != nil else { return }
    let interval = max(OtaStorage.bgIntervalSeconds, 900)
    let request = BGAppRefreshTaskRequest(identifier: kBackgroundTaskIdentifier)
    request.earliestBeginDate = Date(timeIntervalSinceNow: interval)
    do {
      try BGTaskScheduler.shared.submit(request)
    } catch {}
  }

  private static func handleBackgroundCheck(task: BGAppRefreshTask) {
    let versionCheckUrl = OtaStorage.getBgVersionCheckUrl()
    let downloadUrl = OtaStorage.getBgDownloadUrl()
    let bundleSubpath = OtaStorage.getBgBundlePathInZip()
    defer { submitBackgroundCheckRequest() }
    task.expirationHandler = { task.setTaskCompleted(success: false) }

    guard let checkUrl = versionCheckUrl, let url = URL(string: checkUrl) else {
      task.setTaskCompleted(success: true)
      return
    }

    let semaphore = DispatchSemaphore(value: 0)
    var remoteVersion: String?
    var fetchError: Error?
    URLSession.shared.dataTask(with: url) { data, _, err in
      fetchError = err
      if let d = data { remoteVersion = String(data: d, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) }
      semaphore.signal()
    }.resume()
    _ = semaphore.wait(timeout: .now() + 30)
    if fetchError != nil || remoteVersion == nil {
      task.setTaskCompleted(success: true)
      return
    }
    let remote = remoteVersion!.isEmpty ? nil : remoteVersion!
    OtaStorage.lastCheckedRemoteVersion = remote
    let stored = OtaStorage.getStoredVersion()
    if let r = remote, OtaStorage.getBlacklist().contains(r) {
      task.setTaskCompleted(success: true)
      return
    }
    let hasUpdate = stored == nil ? (remote != nil && !(remote?.isEmpty ?? true)) : (remote != stored)
    if !hasUpdate || downloadUrl == nil || downloadUrl!.isEmpty {
      task.setTaskCompleted(success: true)
      return
    }
    do {
      OtaStorage.savePreviousForRollback()
      try performDownloadSync(downloadUrl: downloadUrl!, bundleSubpath: bundleSubpath, expectedChecksum: nil)
      task.setTaskCompleted(success: true)
    } catch {
      task.setTaskCompleted(success: true)
    }
  }
}
#endif

private func performDownloadSync(downloadUrl: String, bundleSubpath: String?, expectedChecksum: String?) throws {
  guard let url = URL(string: downloadUrl) else {
    throw NSError(domain: "NitroUpdate", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid download URL"])
  }
  let semaphore = DispatchSemaphore(value: 0)
  var tempZipURL: URL?
  var downloadError: Error?
  URLSession.shared.downloadTask(with: url) { location, _, err in
    downloadError = err
    tempZipURL = location
    semaphore.signal()
  }.resume()
  _ = semaphore.wait(timeout: .now() + 300)
  if let e = downloadError { throw e }
  guard let zipLocation = tempZipURL else {
    throw NSError(domain: "NitroUpdate", code: 1, userInfo: [NSLocalizedDescriptionKey: "Download failed"])
  }
  let zipPath = zipLocation.path
  defer { try? FileManager.default.removeItem(at: zipLocation) }
  let unzipDir = OtaStorage.bundlesDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
  try FileManager.default.createDirectory(at: unzipDir, withIntermediateDirectories: true)
  try unzipFile(at: zipPath, to: unzipDir.path)
  let bundlePath: String
  if let subpath = bundleSubpath, !subpath.isEmpty {
    bundlePath = unzipDir.appendingPathComponent(subpath).path
  } else {
    guard let found = findBundleFile(in: unzipDir) else {
      throw NSError(domain: "NitroUpdate", code: 2, userInfo: [NSLocalizedDescriptionKey: "No bundle file found in zip"])
    }
    bundlePath = found.path
  }
  if let expected = expectedChecksum, !expected.isEmpty {
    let data = try Data(contentsOf: URL(fileURLWithPath: bundlePath))
    let computed = sha256Hex(data)
    if computed.lowercased() != expected.lowercased() {
      try? FileManager.default.removeItem(at: unzipDir)
      throw NSError(domain: "NitroUpdate", code: 3, userInfo: [NSLocalizedDescriptionKey: "Checksum mismatch"])
    }
  }
  let version = OtaStorage.lastCheckedRemoteVersion ?? "unknown"
  OtaStorage.setStoredVersion(version)
  OtaStorage.setStoredBundlePath(bundlePath)
  OtaStorage.isPendingValidation = true
}

// MARK: - Helpers

private func unzipFile(at path: String, to destination: String) throws {
#if os(macOS)
  let process = Foundation.Process()
  process.executableURL = URL(fileURLWithPath: "/usr/bin/unzip")
  process.arguments = ["-o", path, "-d", destination]
  try process.run()
  process.waitUntilExit()
  guard process.terminationStatus == 0 else {
    throw NSError(domain: "NitroUpdate", code: 4, userInfo: [NSLocalizedDescriptionKey: "Unzip failed"])
  }
#else
  // iOS: Process not available; use minimal ZIP extraction
  let data = try Data(contentsOf: URL(fileURLWithPath: path))
  try unzipData(data, to: URL(fileURLWithPath: destination))
#endif
}

#if !os(macOS)
private func unzipData(_ data: Data, to baseURL: URL) throws {
  let fm = FileManager.default
  try fm.createDirectory(at: baseURL, withIntermediateDirectories: true)
  var offset = 0
  let count = data.count
  while offset + 30 <= count {
    let sig = data.withUnsafeBytes { $0.load(fromByteOffset: offset, as: UInt32.self) }
    guard sig == 0x04034b50 else { break } // local file header
    let compression = data[offset + 8]
    let compressedSize = data.withUnsafeBytes { $0.load(fromByteOffset: offset + 18, as: UInt32.self) }
    let uncompressedSize = data.withUnsafeBytes { $0.load(fromByteOffset: offset + 22, as: UInt32.self) }
    let nameLen = Int(data.withUnsafeBytes { $0.load(fromByteOffset: offset + 26, as: UInt16.self) })
    let extraLen = Int(data.withUnsafeBytes { $0.load(fromByteOffset: offset + 28, as: UInt16.self) })
    offset += 30
    guard offset + nameLen <= count else { break }
    let nameData = data.subdata(in: offset..<(offset + nameLen))
    guard let name = String(data: nameData, encoding: .utf8), !name.hasSuffix("/") else {
      offset += nameLen + extraLen + Int(compressedSize)
      continue
    }
    offset += nameLen + extraLen
    let payload = data.subdata(in: offset..<min(offset + Int(compressedSize), count))
    offset += Int(compressedSize)
    let outURL = baseURL.appendingPathComponent(name)
    try fm.createDirectory(at: outURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    if compression == 0 {
      try payload.write(to: outURL)
    } else if compression == 8 {
      let decoded = try decompressDeflate(payload, expectedSize: Int(uncompressedSize))
      try decoded.write(to: outURL)
    }
  }
}

private func decompressDeflate(_ data: Data, expectedSize: Int) throws -> Data {
  // ZIP uses raw deflate; Compression expects zlib wrapper. Prepend 78 9C (default zlib header).
  var zlibData = Data([0x78, 0x9C])
  zlibData.append(data)
  let destBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: expectedSize)
  defer { destBuffer.deallocate() }
  let written = zlibData.withUnsafeBytes { src in
    compression_decode_buffer(destBuffer, expectedSize, src.bindMemory(to: UInt8.self).baseAddress!, zlibData.count, nil, COMPRESSION_ZLIB)
  }
  guard written > 0 else { throw NSError(domain: "NitroUpdate", code: 5, userInfo: [NSLocalizedDescriptionKey: "Decompress failed"]) }
  return Data(bytes: destBuffer, count: written)
}
#endif

private func findBundleFile(in directory: URL) -> URL? {
  let fm = FileManager.default
  guard let enumerator = fm.enumerator(at: directory, includingPropertiesForKeys: [.isRegularFileKey]) else { return nil }
  for case let file as URL in enumerator {
    guard (try? file.resourceValues(forKeys: [.isRegularFileKey]))?.isRegularFile == true else { continue }
    let ext = file.pathExtension.lowercased()
    let name = file.lastPathComponent.lowercased()
    if ext == "bundle" || ext == "jsbundle" || name == "index.bundle" || name == "main.jsbundle" {
      return file
    }
  }
  return nil
}

private func sha256Hex(_ data: Data) -> String {
  let hash = SHA256.hash(data: data)
  return hash.map { String(format: "%02x", $0) }.joined()
}
