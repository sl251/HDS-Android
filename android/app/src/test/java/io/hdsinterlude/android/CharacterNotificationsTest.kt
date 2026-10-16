package io.hdsinterlude.android

import android.Manifest
import android.app.Application
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.graphics.Bitmap
import android.provider.Settings
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.time.Instant
import java.time.LocalTime

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class CharacterNotificationsTest {
    private lateinit var app: Application
    private lateinit var notifications: CharacterNotifications
    private lateinit var manager: NotificationManager
    private fun message(id: String = "message-1") = CharacterMessage(id, "第一行", "第一行\n这里是全文", Instant.now().plusSeconds(1))
    @Before fun setup() {
        app = RuntimeEnvironment.getApplication()
        app.getSharedPreferences("character-notifications", Context.MODE_PRIVATE).edit().clear().commit()
        AppVisibility.visible = false
        shadowOf(app).grantPermissions(Manifest.permission.POST_NOTIFICATIONS)
        notifications = CharacterNotifications(app)
        manager = app.getSystemService(NotificationManager::class.java)
        notifications.createChannel()
    }
    @After fun cleanup() { AppVisibility.visible = false }
    @Test fun channelIsHighAndDoesNotModifyRuntimeChannel() {
        manager.createNotificationChannel(NotificationChannel("hds-runtime", "HDS 本地运行", NotificationManager.IMPORTANCE_LOW))
        notifications.createChannel()
        assertEquals(NotificationManager.IMPORTANCE_HIGH, manager.getNotificationChannel("character-messages").importance)
        assertEquals(NotificationManager.IMPORTANCE_LOW, manager.getNotificationChannel("hds-runtime").importance)
    }
    @Test fun idsFollowMessageHashAndAlwaysReserve42() {
        for (id in listOf("message-1", "first", "second", "negative-hash-id")) {
            assertEquals(1000 + id.hashCode(), CharacterNotifications.notificationId(id))
            assertNotEquals(42, CharacterNotifications.notificationId(id))
        }
        // Base-31 representation of unsigned -958 produces an actual hash collision.
        var hash = 0xffffffffL - 957
        var crafted = ""
        while (hash > 0) { crafted = (hash % 31).toInt().toChar() + crafted; hash /= 31 }
        assertEquals(-958, crafted.hashCode())
        assertNotEquals(42, CharacterNotifications.notificationId(crafted))
    }
    @Test fun buildsBigTextImmutableDistinctCardIntentAndOptionalLargeIcon() {
        val icon = Bitmap.createBitmap(32, 32, Bitmap.Config.ARGB_8888)
        val first = notifications.build("card-a", "星禾", message(), icon, LocalTime.NOON)
        val second = notifications.build("card-b", "林间", message("message-2"), null, LocalTime.NOON)
        assertEquals("星禾", first.extras.getString(Notification.EXTRA_TITLE))
        assertEquals("第一行", first.extras.getString(Notification.EXTRA_TEXT))
        assertEquals("第一行\n这里是全文", first.extras.getString(Notification.EXTRA_BIG_TEXT))
        assertNotNull(first.getLargeIcon()); assertNull(second.getLargeIcon())
        assertTrue(first.flags and Notification.FLAG_ONLY_ALERT_ONCE != 0)
        assertTrue(first.flags and Notification.FLAG_AUTO_CANCEL != 0)
        assertNull(first.fullScreenIntent)
        val intent = shadowOf(first.contentIntent).savedIntent
        assertEquals(MainActivity::class.java.name, intent.component!!.className)
        assertEquals("card-a", intent.getStringExtra("cardId"))
        assertEquals("card-b", shadowOf(second.contentIntent).savedIntent.getStringExtra("cardId"))
        assertNotEquals(first.contentIntent, second.contentIntent)
        assertTrue(first.contentIntent.isImmutable)
    }
    @Test fun quietWindowIsLocalAndSilentWithoutChangingChannel() {
        for (time in listOf(LocalTime.of(23, 0), LocalTime.MIDNIGHT, LocalTime.of(7, 59))) {
            assertTrue(CharacterNotifications.quietHours(time))
            val value = notifications.build("card", "星禾", message(), null, time)
            assertNull(value.sound); assertNull(value.vibrate)
            assertEquals(0, value.defaults and (Notification.DEFAULT_SOUND or Notification.DEFAULT_VIBRATE))
            // NotificationCompat implements silent with group alert suppression.
            assertEquals(Notification.GROUP_ALERT_SUMMARY, value.groupAlertBehavior)
        }
        for (time in listOf(LocalTime.of(8, 0), LocalTime.of(22, 59))) {
            assertFalse(CharacterNotifications.quietHours(time))
            assertEquals(Notification.GROUP_ALERT_ALL, notifications.build("card", "星禾", message(), null, time).groupAlertBehavior)
        }
        assertEquals(NotificationManager.IMPORTANCE_HIGH, manager.getNotificationChannel(CharacterNotifications.CHANNEL).importance)
    }
    @Test fun nightArrivalRemainsSilentDuringDaytimeCatchup() {
        notifications.setEnabled(true)
        val arrival = java.time.LocalDate.now().plusDays(1).atTime(23, 30).atZone(java.time.ZoneId.systemDefault()).toInstant()
        assertTrue(notifications.receive("card", "星禾", message().copy(occurredAt = arrival), false, time = LocalTime.NOON))
        assertEquals(Notification.GROUP_ALERT_SUMMARY, shadowOf(manager).allNotifications.single().groupAlertBehavior)
    }
    @Test fun foregroundConsumesWithoutNotificationAndSurvivesReloadAndCatchup() {
        notifications.setEnabled(true)
        val message = message()
        AppVisibility.setForeground(true)
        assertFalse(notifications.receive("card", "星禾", message, true))
        assertEquals(message.occurredAt, notifications.watermark("card"))
        AppVisibility.setForeground(false)
        assertFalse(CharacterNotifications(app).receive("card", "星禾", message, false))
        assertEquals(0, shadowOf(manager).allNotifications.size)
        // Foreground-at-arrival remains suppressed if IO runs after Activity pauses.
        assertFalse(notifications.receive("card", "星禾", message("arrived-in-front"), true))
    }
    @Test fun backgroundPushAndPollAreDeduplicatedAndCursorsCannotRegress() {
        notifications.setEnabled(true)
        val message = message()
        assertTrue(notifications.receive("card", "星禾", message, false))
        assertFalse(CharacterNotifications(app).receive("card", "星禾", message, false))
        assertEquals(1, shadowOf(manager).allNotifications.size)
        assertEquals(message.occurredAt, notifications.watermark("card"))
        // An earlier missed marker must still be eligible for reconciliation.
        assertTrue(notifications.cursor("card") < message.occurredAt)
        notifications.reconcile("card", message.occurredAt)
        notifications.reconcile("card", Instant.EPOCH)
        assertEquals(message.occurredAt, CharacterNotifications(app).cursor("card"))
        assertTrue(notifications.cursor("other-card") < message.occurredAt)
    }
    @Test fun seenIdsRetainLatest500AcrossReloadAndTrimLegacySets() {
        val prefs = app.getSharedPreferences("character-notifications", Context.MODE_PRIVATE)
        // Upgrade from the old unbounded, unordered StringSet, including duplicate arrival.
        prefs.edit().putStringSet("seen-card", (0..700).map { "legacy-$it" }.toSet()).commit()
        assertFalse(notifications.receive("card", "星禾", message("legacy-700"), true))
        assertEquals(500, prefs.getStringSet("seen-card", emptySet())!!.size)
        for (index in 0..550) {
            assertFalse(CharacterNotifications(app).receive("card", "星禾", message("recent-$index"), true))
        }
        val expected = (51..550).map { "recent-$it" }.toSet()
        assertEquals(expected, prefs.getStringSet("seen-card", emptySet()))
        val order = org.json.JSONArray(prefs.getString("seen-order-card", "[]"))
        assertEquals(500, order.length())
        assertEquals("recent-51", order.getString(0))
        assertEquals("recent-550", order.getString(499))
        notifications.setEnabled(true)
        assertFalse(CharacterNotifications(app).receive("card", "星禾", message("recent-550"), false))
        assertEquals(expected, prefs.getStringSet("seen-card", emptySet()))
        assertEquals(0, shadowOf(manager).allNotifications.size)
        assertEquals(emptySet<String>(), prefs.getStringSet("seen-other", emptySet()))
    }
    @Test fun optInPermissionGlobalAndChannelDenialsSkipWithoutCrash() {
        assertFalse(notifications.enabled())
        assertFalse(notifications.receive("card", "星禾", message("disabled"), false))
        notifications.setEnabled(true)
        shadowOf(app).denyPermissions(Manifest.permission.POST_NOTIFICATIONS)
        notifications.markRequested()
        assertEquals("denied", notifications.status().getString("permission"))
        assertFalse(notifications.receive("card", "星禾", message("denied"), false))
        shadowOf(app).grantPermissions(Manifest.permission.POST_NOTIFICATIONS)
        shadowOf(manager).setNotificationsEnabled(false)
        assertFalse(notifications.receive("card", "星禾", message("global"), false))
        shadowOf(manager).setNotificationsEnabled(true)
        manager.deleteNotificationChannel(CharacterNotifications.CHANNEL)
        manager.createNotificationChannel(NotificationChannel(CharacterNotifications.CHANNEL, "角色消息", NotificationManager.IMPORTANCE_NONE))
        assertFalse(notifications.receive("card", "星禾", message("channel"), false))
        assertEquals(0, shadowOf(manager).allNotifications.size)
        assertEquals(Settings.ACTION_APP_NOTIFICATION_SETTINGS, notifications.settingsIntent().action)
        assertEquals(app.packageName, notifications.settingsIntent().getStringExtra(Settings.EXTRA_APP_PACKAGE))
    }
}
