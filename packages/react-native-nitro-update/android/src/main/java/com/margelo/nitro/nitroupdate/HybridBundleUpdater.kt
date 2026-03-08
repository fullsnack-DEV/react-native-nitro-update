package com.margelo.nitro.nitroupdate

import android.os.Process
import androidx.annotation.Keep
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.NullType
import com.margelo.nitro.core.Promise
import org.json.JSONArray
import java.io.File
import java.util.concurrent.TimeUnit
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.UUID
import java.util.zip.ZipInputStream

@Keep
@DoNotStrip
class HybridBundleUpdater : HybridBundleUpdaterSpec() {

  override val memorySize: Long get() = 0L

  override fun checkForUpdate(versionCheckUrl: String): Promise<Boolean> = Promise.async {
    val url = URL(versionCheckUrl)
    val conn = url.openConnection() as HttpURLConnection
    conn.requestMethod = "GET"
    conn.connectTimeout = 10_000
    conn.readTimeout = 10_000
    try {
      val remoteVersion = conn.inputStream.bufferedReader().readText().trim()
      OtaStorage.lastCheckedRemoteVersion = remoteVersion.ifEmpty { null }
      val stored = OtaStorage.getStoredVersion()
      if (OtaStorage.getBlacklist().contains(remoteVersion)) return@async false
      if (stored == null) return@async remoteVersion.isNotEmpty()
      remoteVersion != stored
    } finally {
      conn.disconnect()
    }
  }

  override fun downloadUpdate(
    downloadUrl: String,
    bundlePathInZip: Variant_NullType_String?,
    checksum: Variant_NullType_String?
  ): Promise<Unit> = Promise.async {
    val bundleSubpath = bundlePathInZip?.asSecondOrNull()
    val expectedChecksum = checksum?.asSecondOrNull()

    val url = URL(downloadUrl)
    val conn = url.openConnection() as HttpURLConnection
    conn.requestMethod = "GET"
    conn.connectTimeout = 30_000
    conn.readTimeout = 60_000
    val tempZip = File.createTempFile("ota", ".zip", OtaStorage.getBundlesDir())
    try {
      conn.inputStream.use { input ->
        FileOutputStream(tempZip).use { output ->
          input.copyTo(output)
        }
      }
      val unzipDir = File(OtaStorage.getBundlesDir(), UUID.randomUUID().toString())
      unzipDir.mkdirs()
      unzip(tempZip, unzipDir)

      val bundlePath = if (!bundleSubpath.isNullOrEmpty()) {
        File(unzipDir, bundleSubpath).absolutePath
      } else {
        findBundleFile(unzipDir)?.absolutePath ?: throw Error("No bundle file found in zip")
      }

      if (!expectedChecksum.isNullOrEmpty()) {
        val data = File(bundlePath).readBytes()
        val computed = sha256Hex(data)
        if (computed.lowercase() != expectedChecksum.lowercase()) {
          unzipDir.deleteRecursively()
          throw Error("Checksum mismatch")
        }
      }

      val version = OtaStorage.lastCheckedRemoteVersion ?: "unknown"
      OtaStorage.savePreviousForRollback()
      OtaStorage.setStoredVersion(version)
      OtaStorage.setStoredBundlePath(bundlePath)
      OtaStorage.isPendingValidation = true
    } finally {
      tempZip.delete()
      conn.disconnect()
    }
  }

  override fun getStoredVersion(): Variant_NullType_String {
    val v = OtaStorage.getStoredVersion()
    return if (v != null) Variant_NullType_String.create(v) else Variant_NullType_String.create(NullType.NULL)
  }

  override fun getStoredBundlePath(): Variant_NullType_String {
    val p = OtaStorage.getStoredBundlePath()
    return if (p != null) Variant_NullType_String.create(p) else Variant_NullType_String.create(NullType.NULL)
  }

  override fun reloadApp() {
    Process.killProcess(Process.myPid())
  }

  override fun confirmBundle() {
    OtaStorage.isPendingValidation = false
    OtaStorage.clearPrevious()
  }

  override fun rollback(): Promise<Boolean> = Promise.async {
    val prevPath = OtaStorage.getPreviousBundlePath()
    val prevVersion = OtaStorage.getPreviousVersion()
    if (prevPath == null || prevVersion == null) return@async false
    val fromVersion = OtaStorage.getStoredVersion() ?: "unknown"
    OtaStorage.setStoredVersion(prevVersion)
    OtaStorage.setStoredBundlePath(prevPath)
    OtaStorage.isPendingValidation = false
    OtaStorage.appendRollbackRecord(fromVersion, prevVersion, "manual")
    OtaStorage.clearPrevious()
    true
  }

  override fun markBundleBad(reason: String): Promise<Unit> = Promise.async {
    val fromVersion = OtaStorage.getStoredVersion() ?: "unknown"
    val blacklist = OtaStorage.getBlacklist().toMutableList()
    if (!blacklist.contains(fromVersion)) {
      blacklist.add(fromVersion)
      OtaStorage.setBlacklist(blacklist)
    }
    val prevPath = OtaStorage.getPreviousBundlePath()
    val prevVersion = OtaStorage.getPreviousVersion()
    if (prevPath != null && prevVersion != null) {
      OtaStorage.setStoredVersion(prevVersion)
      OtaStorage.setStoredBundlePath(prevPath)
    } else {
      OtaStorage.setStoredVersion(null)
      OtaStorage.setStoredBundlePath(null)
    }
    OtaStorage.isPendingValidation = false
    OtaStorage.appendRollbackRecord(fromVersion, OtaStorage.getStoredVersion() ?: "original", reason)
    OtaStorage.clearPrevious()
  }

  override fun getBlacklist(): Promise<String> = Promise.async {
    val list = OtaStorage.getBlacklist()
    JSONArray(list).toString()
  }

  override fun getRollbackHistory(): Promise<String> = Promise.async {
    val history = OtaStorage.getRollbackHistory()
    JSONArray(history.map { org.json.JSONObject(it) }).toString()
  }

  override fun scheduleBackgroundCheck(
    versionCheckUrl: String,
    downloadUrl: Variant_NullType_String?,
    intervalSeconds: Double
  ) {
    OtaStorage.setBgVersionCheckUrl(versionCheckUrl)
    OtaStorage.setBgDownloadUrl(downloadUrl?.asSecondOrNull())
    OtaStorage.setBgBundlePathInZip(null)
    OtaStorage.bgIntervalSeconds = (intervalSeconds.coerceAtLeast(900.0)).toLong()
    val ctx = OtaStorage.overrideContext ?: com.margelo.nitro.NitroModules.applicationContext ?: return
    val intervalMs = OtaStorage.bgIntervalSeconds.coerceAtLeast(15L) * 1000L
    val request = PeriodicWorkRequestBuilder<BackgroundUpdateWorker>(intervalMs, TimeUnit.MILLISECONDS).build()
    WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
      BackgroundUpdateWorker.WORK_NAME,
      ExistingPeriodicWorkPolicy.KEEP,
      request
    )
  }
}

private fun unzip(zip: File, destDir: File) {
  ZipInputStream(zip.inputStream()).use { zis ->
    var entry = zis.nextEntry
    while (entry != null) {
      val file = File(destDir, entry.name)
      if (entry.isDirectory) {
        file.mkdirs()
      } else {
        file.parentFile?.mkdirs()
        FileOutputStream(file).use { zis.copyTo(it) }
      }
      zis.closeEntry()
      entry = zis.nextEntry
    }
  }
}

private fun findBundleFile(dir: File): File? {
  return dir.walkTopDown().firstOrNull { f ->
    f.isFile && when {
      f.extension.equals("bundle", true) -> true
      f.extension.equals("jsbundle", true) -> true
      f.name.equals("index.bundle", true) -> true
      f.name.equals("main.jsbundle", true) -> true
      else -> false
    }
  }
}

private fun sha256Hex(data: ByteArray): String {
  val digest = MessageDigest.getInstance("SHA-256")
  val hash = digest.digest(data)
  return hash.joinToString("") { "%02x".format(it) }
}
