package com.margelo.nitro.nitroupdate

import android.content.Context
import java.io.File

/**
 * Call from MainApplication to get the JS bundle path when using OTA updates.
 * Override getJSBundleFile() to return this path when non-null.
 */
object NitroUpdateBundleLoader {
  private const val PREFS_NAME = "nitroupdate"
  private const val KEY_BUNDLE_PATH = "bundlePath"
  private const val KEY_VERSION = "version"
  private const val KEY_PENDING_VALIDATION = "pendingValidation"
  private const val KEY_PREVIOUS_BUNDLE_PATH = "previousBundlePath"
  private const val KEY_PREVIOUS_VERSION = "previousVersion"
  private const val KEY_LAUNCH_ATTEMPTS = "launchAttempts"

  private fun recoverIfPendingBundleLikelyCrashed(context: Context) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val pending = prefs.getBoolean(KEY_PENDING_VALIDATION, false)
    var attempts = prefs.getInt(KEY_LAUNCH_ATTEMPTS, 0)

    if (!pending) {
      if (attempts != 0) prefs.edit().putInt(KEY_LAUNCH_ATTEMPTS, 0).apply()
      return
    }

    attempts += 1
    prefs.edit().putInt(KEY_LAUNCH_ATTEMPTS, attempts).apply()

    if (attempts < 2) return

    val prevPath = prefs.getString(KEY_PREVIOUS_BUNDLE_PATH, null)
    val prevVersion = prefs.getString(KEY_PREVIOUS_VERSION, null)

    val editor = prefs.edit()
    if (!prevPath.isNullOrEmpty() && File(prevPath).exists()) {
      editor.putString(KEY_BUNDLE_PATH, prevPath)
      if (!prevVersion.isNullOrEmpty()) editor.putString(KEY_VERSION, prevVersion)
      else editor.remove(KEY_VERSION)
    } else {
      editor.remove(KEY_BUNDLE_PATH)
      editor.remove(KEY_VERSION)
    }

    editor.putBoolean(KEY_PENDING_VALIDATION, false)
    editor.remove(KEY_PREVIOUS_BUNDLE_PATH)
    editor.remove(KEY_PREVIOUS_VERSION)
    editor.putInt(KEY_LAUNCH_ATTEMPTS, 0)
    editor.apply()
  }

  @JvmStatic
  fun getStoredBundlePath(context: Context): String? {
    recoverIfPendingBundleLikelyCrashed(context)
    val path = OtaStorage.getStoredBundlePath(context) ?: return null
    return if (File(path).exists()) path else null
  }
}
