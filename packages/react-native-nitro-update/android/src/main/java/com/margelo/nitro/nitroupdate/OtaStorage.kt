package com.margelo.nitro.nitroupdate

import android.content.Context
import android.content.SharedPreferences
import com.margelo.nitro.NitroModules
import org.json.JSONArray
import java.io.File

internal object OtaStorage {
  /** Set by BackgroundUpdateWorker so storage uses app context when React isn't ready. */
  @Volatile
  var overrideContext: Context? = null

  private const val PREFS_NAME = "nitroupdate"
  private const val KEY_VERSION = "version"
  private const val KEY_BUNDLE_PATH = "bundlePath"
  private const val KEY_PENDING_VALIDATION = "pendingValidation"
  private const val KEY_BLACKLIST = "blacklist"
  private const val KEY_ROLLBACK_HISTORY = "rollbackHistory"
  private const val KEY_PREVIOUS_VERSION = "previousVersion"
  private const val KEY_PREVIOUS_BUNDLE_PATH = "previousBundlePath"
  private const val KEY_LAST_CHECKED_REMOTE_VERSION = "lastCheckedRemoteVersion"
  private const val KEY_BG_VERSION_CHECK_URL = "bgVersionCheckUrl"
  private const val KEY_BG_DOWNLOAD_URL = "bgDownloadUrl"
  private const val KEY_BG_BUNDLE_PATH_IN_ZIP = "bgBundlePathInZip"
  private const val KEY_BG_INTERVAL_SECONDS = "bgIntervalSeconds"

  private val context: Context
    get() = overrideContext ?: NitroModules.applicationContext ?: throw Error("NitroModules.applicationContext not set")

  private fun prefs(ctx: Context): SharedPreferences =
    ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  private val prefs: SharedPreferences get() = prefs(context)

  fun getStoredVersion(ctx: Context): String? = prefs(ctx).getString(KEY_VERSION, null)
  fun getStoredVersion(): String? = prefs.getString(KEY_VERSION, null)

  fun setStoredVersion(value: String?) {
    prefs.edit().apply {
      if (value != null) putString(KEY_VERSION, value) else remove(KEY_VERSION)
      apply()
    }
  }

  fun getStoredBundlePath(ctx: Context): String? = prefs(ctx).getString(KEY_BUNDLE_PATH, null)
  fun getStoredBundlePath(): String? = prefs.getString(KEY_BUNDLE_PATH, null)

  fun setStoredBundlePath(value: String?) {
    prefs.edit().apply {
      if (value != null) putString(KEY_BUNDLE_PATH, value) else remove(KEY_BUNDLE_PATH)
      apply()
    }
  }

  var isPendingValidation: Boolean
    get() = prefs.getBoolean(KEY_PENDING_VALIDATION, false)
    set(value) = prefs.edit().putBoolean(KEY_PENDING_VALIDATION, value).apply()

  var lastCheckedRemoteVersion: String?
    get() = prefs.getString(KEY_LAST_CHECKED_REMOTE_VERSION, null)
    set(value) {
      prefs.edit().apply {
        if (value != null) putString(KEY_LAST_CHECKED_REMOTE_VERSION, value) else remove(KEY_LAST_CHECKED_REMOTE_VERSION)
        apply()
      }
    }

  fun getBlacklist(): List<String> {
    val json = prefs.getString(KEY_BLACKLIST, "[]") ?: "[]"
    val arr = JSONArray(json)
    return (0 until arr.length()).map { arr.getString(it) }
  }

  fun setBlacklist(list: List<String>) {
    val arr = JSONArray(list)
    prefs.edit().putString(KEY_BLACKLIST, arr.toString()).apply()
  }

  fun getRollbackHistory(): List<Map<String, String>> {
    val json = prefs.getString(KEY_ROLLBACK_HISTORY, "[]") ?: "[]"
    val arr = JSONArray(json)
    return (0 until arr.length()).map { i ->
      val obj = arr.getJSONObject(i)
      mapOf(
        "timestamp" to obj.optString("timestamp", ""),
        "fromVersion" to obj.optString("fromVersion", ""),
        "toVersion" to obj.optString("toVersion", ""),
        "reason" to obj.optString("reason", "")
      )
    }
  }

  fun appendRollbackRecord(fromVersion: String, toVersion: String, reason: String) {
    val history = getRollbackHistory().toMutableList()
    history.add(
      mapOf(
        "timestamp" to System.currentTimeMillis().toString(),
        "fromVersion" to fromVersion,
        "toVersion" to toVersion,
        "reason" to reason
      )
    )
    val arr = org.json.JSONArray(history.map { m ->
      org.json.JSONObject(m)
    })
    prefs.edit().putString(KEY_ROLLBACK_HISTORY, arr.toString()).apply()
  }

  fun savePreviousForRollback() {
    prefs.edit()
      .putString(KEY_PREVIOUS_VERSION, getStoredVersion())
      .putString(KEY_PREVIOUS_BUNDLE_PATH, getStoredBundlePath())
      .apply()
  }

  fun getPreviousVersion(): String? = prefs.getString(KEY_PREVIOUS_VERSION, null)
  fun getPreviousBundlePath(): String? = prefs.getString(KEY_PREVIOUS_BUNDLE_PATH, null)

  fun clearPrevious() {
    prefs.edit().remove(KEY_PREVIOUS_VERSION).remove(KEY_PREVIOUS_BUNDLE_PATH).apply()
  }

  fun getBundlesDir(): File {
    val dir = File(context.applicationInfo.dataDir, "nitroupdate_bundles")
    if (!dir.exists()) dir.mkdirs()
    return dir
  }

  fun getBgVersionCheckUrl(): String? = prefs.getString(KEY_BG_VERSION_CHECK_URL, null)
  fun setBgVersionCheckUrl(value: String?) {
    prefs.edit().apply { if (value != null) putString(KEY_BG_VERSION_CHECK_URL, value) else remove(KEY_BG_VERSION_CHECK_URL); apply() }
  }
  fun getBgDownloadUrl(): String? = prefs.getString(KEY_BG_DOWNLOAD_URL, null)
  fun setBgDownloadUrl(value: String?) {
    prefs.edit().apply { if (value != null) putString(KEY_BG_DOWNLOAD_URL, value) else remove(KEY_BG_DOWNLOAD_URL); apply() }
  }
  fun getBgBundlePathInZip(): String? = prefs.getString(KEY_BG_BUNDLE_PATH_IN_ZIP, null)
  fun setBgBundlePathInZip(value: String?) {
    prefs.edit().apply { if (value != null) putString(KEY_BG_BUNDLE_PATH_IN_ZIP, value) else remove(KEY_BG_BUNDLE_PATH_IN_ZIP); apply() }
  }
  var bgIntervalSeconds: Long
    get() = prefs.getLong(KEY_BG_INTERVAL_SECONDS, 3600L).takeIf { it > 0 } ?: 3600L
    set(value) = prefs.edit().putLong(KEY_BG_INTERVAL_SECONDS, value).apply()
}
