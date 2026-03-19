package com.margelo.nitro.nitroupdate

import android.content.Context
import android.util.Log
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.zip.ZipInputStream

/**
 * WorkManager worker that runs the OTA version check and optional download in the background.
 * Uses the same storage and logic as [HybridBundleUpdater]; minimum interval is 15 minutes.
 */
class BackgroundUpdateWorker(
  context: Context,
  params: WorkerParameters
) : Worker(context, params) {

  private fun otaTargetAppVersion(remoteVersion: String): String? {
    val markerIndex = remoteVersion.indexOf("+ota.")
    if (markerIndex <= 0) return null
    val base = remoteVersion.substring(0, markerIndex).trim()
    return base.ifEmpty { null }
  }

  private fun isRemoteVersionCompatibleWithCurrentApp(remoteVersion: String): Boolean {
    val target = otaTargetAppVersion(remoteVersion) ?: return true
    val appVersion = try {
      applicationContext.packageManager.getPackageInfo(applicationContext.packageName, 0).versionName ?: ""
    } catch (_: Exception) {
      ""
    }
    return appVersion.isNotBlank() && target == appVersion.trim()
  }

  override fun doWork(): Result {
    OtaStorage.overrideContext = applicationContext
    try {
      val versionCheckUrl = OtaStorage.getBgVersionCheckUrl() ?: return Result.success()
      val downloadUrl = OtaStorage.getBgDownloadUrl()
      if (versionCheckUrl.isEmpty()) return Result.success()

      val remoteVersion = fetchVersion(versionCheckUrl) ?: return Result.success()
      if (!isRemoteVersionCompatibleWithCurrentApp(remoteVersion)) return Result.success()
      OtaStorage.lastCheckedRemoteVersion = remoteVersion.ifEmpty { null }
      val stored = OtaStorage.getStoredVersion()
      if (OtaStorage.getBlacklist().contains(remoteVersion)) return Result.success()
      val hasUpdate = stored == null && remoteVersion.isNotEmpty() || stored != null && remoteVersion != stored
      if (!hasUpdate || downloadUrl.isNullOrEmpty()) return Result.success()

      runDownload(applicationContext, downloadUrl, OtaStorage.getBgBundlePathInZip())
      return Result.success()
    } catch (e: Exception) {
      Log.w(TAG, "Background OTA check failed", e)
      return Result.success()
    } finally {
      OtaStorage.overrideContext = null
    }
  }

  private fun fetchVersion(urlString: String): String? {
    return try {
      val conn = URL(urlString).openConnection() as HttpURLConnection
      conn.requestMethod = "GET"
      conn.connectTimeout = 10_000
      conn.readTimeout = 10_000
      conn.inputStream.bufferedReader().readText().trim()
    } catch (_: Exception) {
      null
    } finally {
      (URL(urlString).openConnection() as? HttpURLConnection)?.disconnect()
    }
  }

  private fun runDownload(ctx: Context, downloadUrl: String, bundlePathInZip: String?) {
    val conn = URL(downloadUrl).openConnection() as HttpURLConnection
    conn.requestMethod = "GET"
    conn.connectTimeout = 30_000
    conn.readTimeout = 60_000
    val bundlesDir = File(ctx.applicationInfo.dataDir, "nitroupdate_bundles").apply { if (!exists()) mkdirs() }
    val tempZip = File.createTempFile("ota", ".zip", bundlesDir)
    try {
      conn.inputStream.use { input -> FileOutputStream(tempZip).use { output -> input.copyTo(output) } }
      val unzipDir = File(bundlesDir, UUID.randomUUID().toString()).apply { mkdirs() }
      unzip(tempZip, unzipDir)
      val bundlePath = if (!bundlePathInZip.isNullOrEmpty()) {
        File(unzipDir, bundlePathInZip).absolutePath
      } else {
        findBundleFile(unzipDir)?.absolutePath ?: return
      }
      OtaStorage.savePreviousForRollback()
      OtaStorage.setStoredVersion(OtaStorage.lastCheckedRemoteVersion ?: "unknown")
      OtaStorage.setStoredBundlePath(bundlePath)
      OtaStorage.isPendingValidation = true
    } finally {
      tempZip.delete()
      conn.disconnect()
    }
  }

  private fun unzip(zip: File, destDir: File) {
    ZipInputStream(zip.inputStream()).use { zis ->
      var entry = zis.nextEntry
      while (entry != null) {
        val file = File(destDir, entry.name)
        if (entry.isDirectory) file.mkdirs()
        else {
          file.parentFile?.mkdirs()
          FileOutputStream(file).use { zis.copyTo(it) }
        }
        zis.closeEntry()
        entry = zis.nextEntry
      }
    }
  }

  private fun findBundleFile(dir: File): File? {
    dir.listFiles()?.forEach { f ->
      if (f.isDirectory) findBundleFile(f)?.let { return it }
      else {
        val name = f.name.lowercase()
        val ext = f.extension.lowercase()
        if (ext == "bundle" || ext == "jsbundle" || name == "index.bundle" || name == "main.jsbundle") return f
      }
    }
    return null
  }

  companion object {
    private const val TAG = "NitroUpdateBG"
    const val WORK_NAME = "NitroUpdateBackgroundCheck"
  }
}
