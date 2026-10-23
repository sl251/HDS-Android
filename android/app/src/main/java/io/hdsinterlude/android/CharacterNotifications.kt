package io.hdsinterlude.android

import android.Manifest
import android.app.Notification
import androidx.core.app.NotificationCompat
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.provider.Settings
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.Instant
import java.time.LocalTime

/** Activity state is available even while WebView timers are frozen. */
object AppVisibility {
    @Volatile var visible = false
    @JvmStatic fun setForeground(value: Boolean) { visible = value }
}

class CharacterNotifications(private val context: Context) {
    companion object {
        const val CHANNEL = "character-messages"
        const val CARD_EXTRA = "cardId"
        private const val MAX_SEEN = 500
        private val lock = Any()
        fun notificationId(id: String): Int {
            val value = 1000 + id.hashCode()
            // hashCode spans every Int; reserve the service ID even for hash -958.
            return if (value == 42) 1000 else value
        }
        fun quietHours(time: LocalTime) = time.hour >= 23 || time.hour < 8
    }
    private val prefs = context.getSharedPreferences("character-notifications", Context.MODE_PRIVATE)
    private val manager = context.getSystemService(NotificationManager::class.java)
    init { synchronized(lock) {
        if (!prefs.contains("baseline")) prefs.edit().putString("baseline", Instant.now().toString()).commit()
    } }
    fun createChannel() {
        manager.createNotificationChannel(NotificationChannel(CHANNEL, "角色消息 · 悬浮提醒", NotificationManager.IMPORTANCE_HIGH))
        manager.createNotificationChannel(NotificationChannel("character-normal", "角色消息 · 通知栏", NotificationManager.IMPORTANCE_DEFAULT))
        manager.createNotificationChannel(NotificationChannel("character-silent", "角色消息 · 静默", NotificationManager.IMPORTANCE_LOW).apply { setSound(null, null); enableVibration(false) })
    }
    private fun channel() = when (prefs.getString("mode", "popup")) { "normal" -> "character-normal"; "silent" -> "character-silent"; else -> CHANNEL }
    private fun isQuiet(time: LocalTime): Boolean {
        if (!prefs.getBoolean("quietEnabled", true)) return false
        val start = prefs.getInt("quietStart", 23); val end = prefs.getInt("quietEnd", 8)
        return if (start == end) true else if (start < end) time.hour >= start && time.hour < end else time.hour >= start || time.hour < end
    }
    fun configure(input: JSONObject) = synchronized(lock) {
        val mode = input.optString("mode", prefs.getString("mode", "popup"))
        require(mode in listOf("popup", "normal", "silent")) { "提醒形式无效" }
        val start = input.optInt("quietStart", prefs.getInt("quietStart", 23)); val end = input.optInt("quietEnd", prefs.getInt("quietEnd", 8))
        require(start in 0..23 && end in 0..23) { "安静时段应为 0 至 23 时" }
        prefs.edit().putString("mode", mode).putInt("quietStart", start).putInt("quietEnd", end)
            .putBoolean("preview", input.optBoolean("preview", prefs.getBoolean("preview", true)))
            .putBoolean("foreground", input.optBoolean("foreground", prefs.getBoolean("foreground", false)))
            .putBoolean("quietEnabled", input.optBoolean("quietEnabled", prefs.getBoolean("quietEnabled", true))).commit()
    }
    fun enabled() = prefs.getBoolean("enabled", false)
    fun setEnabled(value: Boolean) = synchronized(lock) {
        val edit = prefs.edit().putBoolean("enabled", value)
        // Consent starts now, never replay messages from before the user opted in.
        if (value && !enabled()) edit.putString("baseline", Instant.now().toString())
        edit.commit()
    }
    fun allowed(): Boolean = (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) &&
        manager.areNotificationsEnabled() && manager.getNotificationChannel(channel())?.importance != NotificationManager.IMPORTANCE_NONE
    fun status(): JSONObject {
        createChannel()
        val permission = Build.VERSION.SDK_INT < 33 || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        return JSONObject().put("enabled", enabled()).put("permission", if (permission) "granted" else if (prefs.getBoolean("requested", false)) "denied" else "prompt")
            .put("available", allowed()).put("mode", prefs.getString("mode", "popup")).put("preview", prefs.getBoolean("preview", true))
            .put("foreground", prefs.getBoolean("foreground", false)).put("quietEnabled", prefs.getBoolean("quietEnabled", true))
            .put("quietStart", prefs.getInt("quietStart", 23)).put("quietEnd", prefs.getInt("quietEnd", 8))
    }
    fun markRequested() { prefs.edit().putBoolean("requested", true).commit() }
    fun settingsIntent() = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
    private fun baseline() = Instant.parse(prefs.getString("baseline", Instant.EPOCH.toString()))
    fun cursor(cardId: String): Instant = synchronized(lock) {
        maxOf(baseline(), Instant.parse(prefs.getString("cursor-$cardId", Instant.EPOCH.toString())))
    }
    fun reconcile(cardId: String, through: Instant) = synchronized(lock) {
        if (through > cursor(cardId)) prefs.edit().putString("cursor-$cardId", through.toString()).commit()
    }
    fun watermark(cardId: String): Instant = Instant.parse(prefs.getString("latest-$cardId", Instant.EPOCH.toString()))

    /** Called sequentially on service IO for both stdout and catch-up. Mark even
     * suppressed messages consumed so a later background poll cannot alert them. */
    fun receive(cardId: String, name: String, message: CharacterMessage, foregroundAtArrival: Boolean, avatar: () -> Bitmap? = { null }, time: LocalTime = LocalTime.now()): Boolean = synchronized(lock) {
        val seen = prefs.getStringSet("seen-$cardId", emptySet())!!
        val duplicate = message.id in seen
        if (duplicate && seen.size <= MAX_SEEN) return false
        // StringSet does not preserve order across process restarts. Keep a bounded
        // insertion-order companion; legacy sets have no recoverable arrival order.
        val order = JSONArray(prefs.getString("seen-order-$cardId", "[]"))
        val ordered = linkedSetOf<String>()
        for (index in 0 until order.length()) {
            val id = order.getString(index)
            if (id in seen) ordered.add(id)
        }
        val legacy = (seen - ordered).sorted()
        val recent = (legacy + ordered + if (duplicate) emptyList() else listOf(message.id)).takeLast(MAX_SEEN)
        val latest = maxOf(watermark(cardId), message.occurredAt)
        prefs.edit().putStringSet("seen-$cardId", recent.toSet())
            .putString("seen-order-$cardId", JSONArray(recent).toString())
            .putString("latest-$cardId", latest.toString()).commit()
        if (duplicate) return false
        if (!enabled() || message.occurredAt <= baseline() || foregroundAtArrival || AppVisibility.visible) return false
        try {
            createChannel()
            if (!allowed()) { Log.i("HDS", "角色消息通知跳过：系统权限或渠道关闭"); return false }
            // A quiet-hour arrival stays silent even if catch-up runs after 08:00.
            val arrival = message.occurredAt.atZone(java.time.ZoneId.systemDefault()).toLocalTime()
            manager.notify(notificationId(message.id), build(cardId, name, message, avatar(), if (isQuiet(arrival)) arrival else time))
            true
        } catch (failure: Exception) {
            Log.i("HDS", "角色消息通知跳过：${failure.javaClass.simpleName}")
            false
        }
    }
    fun build(cardId: String, name: String, message: CharacterMessage, avatar: Bitmap?, time: LocalTime): Notification {
        val intent = Intent(context, MainActivity::class.java).setAction("io.hdsinterlude.android.OPEN_CHARACTER")
            .setData(android.net.Uri.parse("hds://character/$cardId/${message.id}"))
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra(CARD_EXTRA, cardId)
        val open = PendingIntent.getActivity(context, notificationId(message.id), intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val builder = NotificationCompat.Builder(context, channel()).setSmallIcon(android.R.drawable.ic_menu_edit)
            .setContentTitle(name).setContentText(if (prefs.getBoolean("preview", true)) message.content.lineSequence().first().codePoints().limit(40).toArray().let { String(it, 0, it.size) } else "你收到了一条新消息")
            .setStyle(NotificationCompat.BigTextStyle().bigText(if (prefs.getBoolean("preview", true)) message.fullContent else "你收到了一条新消息")).setContentIntent(open)
            .setAutoCancel(true).setOnlyAlertOnce(true).setSilent(isQuiet(time) || channel() == "character-silent").setVisibility(if (prefs.getBoolean("preview", true)) NotificationCompat.VISIBILITY_PRIVATE else NotificationCompat.VISIBILITY_SECRET)
        if (avatar != null) builder.setLargeIcon(avatar)
        return builder.build()
    }

    /** PNG card artwork is kept in the original import; bound decoding to icon size. */
    fun avatar(store: HdsStore, cardId: String): Bitmap? = try {
        val file = File(store.base, "cards/$cardId.source")
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) null else {
            val options = BitmapFactory.Options().apply {
                inSampleSize = 1
                while (maxOf(bounds.outWidth, bounds.outHeight) / inSampleSize > 256) inSampleSize *= 2
            }
            BitmapFactory.decodeFile(file.path, options)
        }
    } catch (_: Exception) { null }
}
