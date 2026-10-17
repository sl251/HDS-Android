package io.hdsinterlude.android

import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.PowerManager
import org.json.JSONObject

class BackgroundPolicy(private val context: Context) {
    private val prefs = context.getSharedPreferences("hds-background", Context.MODE_PRIVATE)
    fun enabled() = prefs.getBoolean("enabled", false)
    fun markStart(cardId: String) { if (enabled()) prefs.edit().putBoolean("desired", true).putString("cardId", cardId).putString("build", RuntimeContract.VERSION).putInt("attempts", 0).putLong("retryAt", 0).commit() }
    fun stop() { prefs.edit().putBoolean("desired", false).putInt("attempts", 0).commit() }
    fun wantsRestore() = enabled() && prefs.getBoolean("desired", false)
    fun qqDesired() = prefs.getBoolean("qqDesired", false)
    fun setQQDesired(value: Boolean) { prefs.edit().putBoolean("qqDesired", value).commit() }
    fun eligible(cardId: String): Boolean = wantsRestore() && prefs.getString("cardId", "") == cardId && prefs.getString("build", "") == RuntimeContract.VERSION && prefs.getInt("attempts", 0) < 3 && System.currentTimeMillis() >= prefs.getLong("retryAt", 0)
    fun attempt() { val n = prefs.getInt("attempts", 0) + 1; prefs.edit().putInt("attempts", n).putLong("retryAt", System.currentTimeMillis() + 30000L * (1L shl n)).commit() }
    fun stable() { prefs.edit().putInt("attempts", 0).putLong("retryAt", 0).apply() }
    fun setEnabled(value: Boolean) { prefs.edit().putBoolean("enabled", value).commit(); if (!value) stop() }
    fun snapshot(): JSONObject {
        val power = context.getSystemService(PowerManager::class.java)
        val network = context.getSystemService(ConnectivityManager::class.java)
        val caps = network.activeNetwork?.let { network.getNetworkCapabilities(it) }
        return JSONObject().put("enabled", enabled()).put("desired", wantsRestore()).put("attempts", prefs.getInt("attempts", 0)).put("retryAt", prefs.getLong("retryAt", 0))
            .put("buildMatches", prefs.getString("build", "") == RuntimeContract.VERSION)
            .put("visible", AppVisibility.visible).put("screenOn", power.isInteractive).put("doze", power.isDeviceIdleMode)
            .put("batteryUnrestricted", power.isIgnoringBatteryOptimizations(context.packageName))
            .put("notificationAllowed", androidx.core.app.NotificationManagerCompat.from(context).areNotificationsEnabled())
            .put("networkAvailable", caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true)
            .put("networkValidated", caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true)
            .put("networkType", when { caps == null -> "none"; caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"; caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"; else -> "other" })
    }
    fun settingsIntent() = Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
}
