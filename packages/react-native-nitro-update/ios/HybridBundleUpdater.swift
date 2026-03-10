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

private func isValidVersionString(_ s: String) -> Bool {
  let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
  if t.isEmpty || t.count > 64 { return false }
  if t.contains("<") || t.contains(">") { return false }
  return true
}

private func sanitizeVersion(_ s: String?) -> String? {
  guard let s = s, isValidVersionString(s) else { return nil }
  return s.trimmingCharacters(in: .whitespacesAndNewlines)
}

public final class HybridBundleUpdater: HybridBundleUpdaterSpec_base, HybridBundleUpdaterSpec_protocol {
  
  public override init() {
    super.init()
    OtaStorage.invalidateIfAppVersionChanged()
  }
  
  // MARK: - App version
  
  public func getAppVersion() throws -> String {
    Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.0.0"
  }
  
  // MARK: - Version check
  
  public func checkForUpdate(versionCheckUrl: String) throws -> Promise<Bool> {
    Promise.async {
      guard let url = URL(string: versionCheckUrl) else { return false }
      var request = URLRequest(url: url)
      request.setValue("text/plain", forHTTPHeaderField: "Accept")
      let (data, response) = try await URLSession.shared.data(for: request)
      if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
        return false
      }
      let raw = String(data: data, encoding: .utf8) ?? ""
      guard let remoteVersion = sanitizeVersion(raw) else {
        OtaStorage.lastCheckedRemoteVersion = nil
        return false
      }
      OtaStorage.lastCheckedRemoteVersion = remoteVersion
      let stored = sanitizeVersion(OtaStorage.getStoredVersion())
      if OtaStorage.getBlacklist().contains(remoteVersion) { return false }
      if stored == nil || stored!.isEmpty { return true }
      return remoteVersion != stored
    }
  }
  
  // MARK: - Download
  
  public func downloadUpdate(
    downloadUrl: String,
    bundlePathInZip: Variant_NullType_String?,
    checksum: Variant_NullType_String?
  ) throws -> Promise<Void> {
    let bundleSubpath = unwrapOptionalString(bundlePathInZip)
    let expectedChecksum = unwrapOptionalString(checksum)
    
    return Promise.async {
      guard let url = URL(string: downloadUrl) else {
        throw NitroUpdateError.invalidURL(downloadUrl)
      }
      OtaStorage.savePreviousForRollback()
      
      let (tempZipLocation, response) = try await URLSession.shared.download(from: url)
      if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
        throw NitroUpdateError.httpError(http.statusCode)
      }
      defer { try? FileManager.default.removeItem(at: tempZipLocation) }
      
      let unzipDir = OtaStorage.bundlesDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
      try FileManager.default.createDirectory(at: unzipDir, withIntermediateDirectories: true)
      try unzipFile(at: tempZipLocation.path, to: unzipDir.path)
      
      let bundlePath: String
      if let subpath = bundleSubpath, !subpath.isEmpty {
        bundlePath = unzipDir.appendingPathComponent(subpath).path
      } else {
        guard let found = findBundleFile(in: unzipDir) else {
          try? FileManager.default.removeItem(at: unzipDir)
          throw NitroUpdateError.noBundleFound
        }
        bundlePath = found.path
      }
      
      guard FileManager.default.fileExists(atPath: bundlePath) else {
        try? FileManager.default.removeItem(at: unzipDir)
        throw NitroUpdateError.noBundleFound
      }
      
      if let expected = expectedChecksum, !expected.isEmpty {
        let data = try Data(contentsOf: URL(fileURLWithPath: bundlePath))
        let computed = sha256Hex(data)
        if computed.lowercased() != expected.lowercased() {
          try? FileManager.default.removeItem(at: unzipDir)
          throw NitroUpdateError.checksumMismatch
        }
      }
      
      let version = sanitizeVersion(OtaStorage.lastCheckedRemoteVersion) ?? "unknown"
      OtaStorage.setStoredVersion(version)
      OtaStorage.setStoredBundlePath(bundlePath)
      OtaStorage.isPendingValidation = true
    }
  }
  
  // MARK: - Stored state
  
  public func getStoredVersion() throws -> Variant_NullType_String {
    let raw = OtaStorage.getStoredVersion()
    if let valid = sanitizeVersion(raw) { return .second(valid) }
    if raw != nil && !(raw?.isEmpty ?? true) { OtaStorage.setStoredVersion(nil) }
    return .first(NullType.null)
  }
  
  public func getStoredBundlePath() throws -> Variant_NullType_String {
    wrapOptionalString(OtaStorage.getStoredBundlePath())
  }
  
  // MARK: - Reload
  
  public func reloadApp() throws {
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
      exit(0)
    }
  }
  
  // MARK: - Confirm / Rollback
  
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
      guard FileManager.default.fileExists(atPath: prevPath) else {
        OtaStorage.clearPrevious()
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
      if let prevPath = OtaStorage.getPreviousBundlePath(),
         let prevVersion = OtaStorage.getPreviousVersion(),
         FileManager.default.fileExists(atPath: prevPath) {
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
  
  // MARK: - Blacklist / History
  
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
  
  // MARK: - Background check
  
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

// MARK: - Typed errors

private enum NitroUpdateError: LocalizedError {
  case invalidURL(String)
  case httpError(Int)
  case noBundleFound
  case checksumMismatch
  case unzipFailed
  case decompressFailed
  
  var errorDescription: String? {
    switch self {
    case .invalidURL(let url): return "Invalid URL: \(url)"
    case .httpError(let code): return "HTTP error \(code)"
    case .noBundleFound: return "No bundle file found in zip"
    case .checksumMismatch: return "Checksum mismatch"
    case .unzipFailed: return "Unzip failed"
    case .decompressFailed: return "Decompress failed"
    }
  }
}

// MARK: - Background task (iOS)

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
    try? BGTaskScheduler.shared.submit(request)
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
    
    if fetchError != nil { task.setTaskCompleted(success: true); return }
    guard let remote = sanitizeVersion(remoteVersion) else { task.setTaskCompleted(success: true); return }
    
    OtaStorage.lastCheckedRemoteVersion = remote
    let stored = OtaStorage.getStoredVersion()
    if OtaStorage.getBlacklist().contains(remote) { task.setTaskCompleted(success: true); return }
    
    let hasUpdate = stored == nil ? true : (remote != stored)
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
  guard let url = URL(string: downloadUrl) else { throw NitroUpdateError.invalidURL(downloadUrl) }
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
  guard let zipLocation = tempZipURL else { throw NitroUpdateError.httpError(0) }
  defer { try? FileManager.default.removeItem(at: zipLocation) }
  
  let unzipDir = OtaStorage.bundlesDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
  try FileManager.default.createDirectory(at: unzipDir, withIntermediateDirectories: true)
  try unzipFile(at: zipLocation.path, to: unzipDir.path)
  
  let bundlePath: String
  if let subpath = bundleSubpath, !subpath.isEmpty {
    bundlePath = unzipDir.appendingPathComponent(subpath).path
  } else {
    guard let found = findBundleFile(in: unzipDir) else { throw NitroUpdateError.noBundleFound }
    bundlePath = found.path
  }
  if let expected = expectedChecksum, !expected.isEmpty {
    let data = try Data(contentsOf: URL(fileURLWithPath: bundlePath))
    let computed = sha256Hex(data)
    if computed.lowercased() != expected.lowercased() {
      try? FileManager.default.removeItem(at: unzipDir)
      throw NitroUpdateError.checksumMismatch
    }
  }
  let version = sanitizeVersion(OtaStorage.lastCheckedRemoteVersion) ?? "unknown"
  OtaStorage.setStoredVersion(version)
  OtaStorage.setStoredBundlePath(bundlePath)
  OtaStorage.isPendingValidation = true
}

// MARK: - Zip extraction

private func unzipFile(at path: String, to destination: String) throws {
#if os(macOS)
  let process = Foundation.Process()
  process.executableURL = URL(fileURLWithPath: "/usr/bin/unzip")
  process.arguments = ["-o", path, "-d", destination]
  try process.run()
  process.waitUntilExit()
  guard process.terminationStatus == 0 else { throw NitroUpdateError.unzipFailed }
#else
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
    let sig = readUInt32(data, at: offset)
    guard sig == 0x04034b50 else { break }
    let compression = readUInt16(data, at: offset + 8)
    let compressedSize = Int(readUInt32(data, at: offset + 18))
    let uncompressedSize = Int(readUInt32(data, at: offset + 22))
    let nameLen = Int(readUInt16(data, at: offset + 26))
    let extraLen = Int(readUInt16(data, at: offset + 28))
    offset += 30
    
    guard offset + nameLen <= count else { break }
    let nameData = data.subdata(in: offset..<(offset + nameLen))
    let name = String(data: nameData, encoding: .utf8) ?? ""
    
    if name.isEmpty || name.hasSuffix("/") {
      offset += nameLen + extraLen + compressedSize
      continue
    }
    
    offset += nameLen + extraLen
    guard offset + compressedSize <= count else { break }
    
    let payload = data.subdata(in: offset..<(offset + compressedSize))
    offset += compressedSize
    
    let outURL = baseURL.appendingPathComponent(name)
    try fm.createDirectory(at: outURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    
    if compression == 0 {
      try payload.write(to: outURL)
    } else if compression == 8 {
      let decoded = try decompressDeflate(payload, expectedSize: uncompressedSize)
      try decoded.write(to: outURL)
    }
  }
}

private func readUInt32(_ data: Data, at offset: Int) -> UInt32 {
  var value: UInt32 = 0
  withUnsafeMutableBytes(of: &value) { dest in
    data.copyBytes(to: dest.bindMemory(to: UInt8.self), from: offset..<(offset + 4))
  }
  return value
}

private func readUInt16(_ data: Data, at offset: Int) -> UInt16 {
  var value: UInt16 = 0
  withUnsafeMutableBytes(of: &value) { dest in
    data.copyBytes(to: dest.bindMemory(to: UInt8.self), from: offset..<(offset + 2))
  }
  return value
}

private func decompressDeflate(_ data: Data, expectedSize: Int) throws -> Data {
  guard expectedSize > 0 else { throw NitroUpdateError.decompressFailed }
  let bufferSize = expectedSize + 1024
  let destBuffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
  defer { destBuffer.deallocate() }
  
  // Try raw deflate first (standard ZIP), fall back to zlib-wrapped
  let written = data.withUnsafeBytes { src -> Int in
    guard let base = src.bindMemory(to: UInt8.self).baseAddress else { return 0 }
    return compression_decode_buffer(destBuffer, bufferSize, base, data.count, nil, COMPRESSION_ZLIB)
  }
  if written > 0 { return Data(bytes: destBuffer, count: written) }
  
  var zlibData = Data([0x78, 0x9C])
  zlibData.append(data)
  let retryWritten = zlibData.withUnsafeBytes { src -> Int in
    guard let base = src.bindMemory(to: UInt8.self).baseAddress else { return 0 }
    return compression_decode_buffer(destBuffer, bufferSize, base, zlibData.count, nil, COMPRESSION_ZLIB)
  }
  guard retryWritten > 0 else { throw NitroUpdateError.decompressFailed }
  return Data(bytes: destBuffer, count: retryWritten)
}
#endif

// MARK: - Bundle discovery

private func findBundleFile(in directory: URL) -> URL? {
  let fm = FileManager.default
  guard let enumerator = fm.enumerator(at: directory, includingPropertiesForKeys: [.isRegularFileKey]) else { return nil }
  for case let file as URL in enumerator {
    guard (try? file.resourceValues(forKeys: [.isRegularFileKey]))?.isRegularFile == true else { continue }
    let ext = file.pathExtension.lowercased()
    let name = file.lastPathComponent.lowercased()
    if ext == "bundle" || ext == "jsbundle" ||
       name == "index.bundle" || name == "main.jsbundle" || name == "index.ios.jsbundle" {
      return file
    }
  }
  return nil
}

private func sha256Hex(_ data: Data) -> String {
  SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
}
