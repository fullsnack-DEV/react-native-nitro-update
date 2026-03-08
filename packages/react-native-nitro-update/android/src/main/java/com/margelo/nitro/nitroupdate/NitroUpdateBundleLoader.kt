package com.margelo.nitro.nitroupdate

import android.content.Context
import java.io.File

/**
 * Call from MainApplication to get the JS bundle path when using OTA updates.
 * Override getJSBundleFile() to return this path when non-null.
 */
object NitroUpdateBundleLoader {
  @JvmStatic
  fun getStoredBundlePath(context: Context): String? {
    val path = OtaStorage.getStoredBundlePath(context) ?: return null
    return if (File(path).exists()) path else null
  }
}
