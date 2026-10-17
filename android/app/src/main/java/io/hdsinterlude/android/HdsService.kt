package io.hdsinterlude.android

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.os.PowerManager
import android.os.Handler
import android.os.Looper

class HdsService : Service() {
    companion object {
        @Volatile private var active: HdsService? = null
        fun stop(context: android.content.Context, preserveIntent: Boolean = false) {
            if (preserveIntent && BackgroundPolicy(context).wantsRestore()) return
            if (!preserveIntent) BackgroundPolicy(context).stop()
            active?.intentionalStop = true
            context.stopService(Intent(context, HdsService::class.java))
        }
    }
    @Volatile private var intentionalStop = false
    private var wakeLock: PowerManager.WakeLock? = null
    private var healthySince = 0L
    private val powerReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: android.content.Context, intent: Intent) { HdsRuntime.get(this@HdsService).recordBackground("power-or-screen-change") }
    }
    private val network by lazy { getSystemService(android.net.ConnectivityManager::class.java) }
    private val networkCallback = object : android.net.ConnectivityManager.NetworkCallback() {
        override fun onAvailable(value: android.net.Network) { HdsRuntime.get(this@HdsService).networkChanged() }
        override fun onLost(value: android.net.Network) { HdsRuntime.get(this@HdsService).networkChanged() }
        override fun onCapabilitiesChanged(value: android.net.Network, capabilities: android.net.NetworkCapabilities) { HdsRuntime.get(this@HdsService).networkChanged() }
        override fun onLinkPropertiesChanged(value: android.net.Network, properties: android.net.LinkProperties) { HdsRuntime.get(this@HdsService).networkChanged() }
    }
    private fun restoreIfAllowed() {
        val runtime = HdsRuntime.get(this); val policy = BackgroundPolicy(this)
        val status = runtime.status(); val state = status.optString("state")
        if (state == "healthy") { if (healthySince == 0L) healthySince = System.currentTimeMillis(); if (System.currentTimeMillis() - healthySince >= 600000) policy.stable(); return }
        healthySince = 0L
        if (state !in listOf("failed", "stopped") || intentionalStop) return
        val cardId = runtime.store.publicSettings().optString("activeCard")
        if (policy.eligible(cardId) && policy.snapshot().optBoolean("networkAvailable") && status.optBoolean("installed")) {
            policy.attempt()
            try { runtime.startAsync() } catch (_: Exception) { /* Persisted backoff limits retries. */ }
        }
    }
    private val messageIo = java.util.concurrent.Executors.newSingleThreadExecutor()
    private lateinit var messages: CharacterNotifications
    private val push: (String, String, CharacterMessage, Boolean) -> Unit = { id, name, message, foreground ->
        enqueueMessages { messages.receive(id, name, message, foreground, { messages.avatar(HdsRuntime.get(this).store, id) }) }
    }
    private fun enqueueMessages(work: () -> Unit) {
        try { messageIo.execute { try { work() } catch (failure: Exception) { android.util.Log.i("HDS", "角色消息补拉跳过：${failure.javaClass.simpleName}") } } }
        catch (_: java.util.concurrent.RejectedExecutionException) { /* Service already stopped. */ }
    }
    private fun catchUp() {
        val runtime = HdsRuntime.get(this)
        if (runtime.status().optString("state") != "healthy") return
        val cardId = runtime.runningCardId; val name = runtime.runningCardName
        if (cardId.isBlank()) return
        // Drain bounded pages in timestamp order. Stdout never advances this
        // reconciliation cursor, so missed older pushes remain recoverable.
        var since = messages.cursor(cardId)
        repeat(20) {
            if (active !== this || intentionalStop || runtime.runningCardId != cardId) return
            val rows = runtime.rpc("messages.since", org.json.JSONObject().put("since", since.toString()).put("limit", 200)).getJSONArray("data")
            if (active !== this || intentionalStop || runtime.runningCardId != cardId) return
            val foreground = AppVisibility.visible
            if (rows.length() == 0) return
            var through = since
            for (i in 0 until rows.length()) {
                val message = CharacterMessage.fromJson(rows.getJSONObject(i)) ?: throw IllegalArgumentException("无效消息")
                messages.receive(cardId, name, message, foreground, { messages.avatar(runtime.store, cardId) })
                through = maxOf(through, message.occurredAt)
            }
            if (through <= since) return
            messages.reconcile(cardId, through); since = through
            if (rows.length() < 200) return
        }
    }
    private val handler = Handler(Looper.getMainLooper())
    private val health = object : Runnable { override fun run() {
        restoreIfAllowed()
        HdsRuntime.get(this@HdsService).refreshServiceHealth {
            enqueueMessages { catchUp() }
            handler.post {
                if (active === this@HdsService && !intentionalStop) {
                    if (android.os.Build.VERSION.SDK_INT < 33 || checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                        getSystemService(NotificationManager::class.java).notify(42, notification())
                    }
                    handler.postDelayed(this, 60_000L)
                }
            }
        }
    } }
    private val renew = object : Runnable { override fun run() { wakeLock?.acquire(10 * 60 * 1000L); handler.postDelayed(this, 9 * 60 * 1000L) } }
    override fun onCreate() {
        super.onCreate()
        active = this
        HdsRuntime.get(this).recordBackground("service-created")
        val powerEvents = android.content.IntentFilter().apply { addAction(Intent.ACTION_SCREEN_ON); addAction(Intent.ACTION_SCREEN_OFF); addAction(PowerManager.ACTION_DEVICE_IDLE_MODE_CHANGED); addAction(Intent.ACTION_POWER_CONNECTED); addAction(Intent.ACTION_POWER_DISCONNECTED) }
        androidx.core.content.ContextCompat.registerReceiver(this, powerReceiver, powerEvents, androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED)
        network.registerDefaultNetworkCallback(networkCallback)
        messages = CharacterNotifications(this)
        messages.createChannel()
        HdsRuntime.get(this).messagePush = push
        wakeLock = getSystemService(PowerManager::class.java).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "HDS:runtime").apply { setReferenceCounted(false) }
        renew.run()
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel("hds-runtime", "HDS 本地运行", NotificationManager.IMPORTANCE_LOW))
        startForeground(42, notification())
        handler.postDelayed(health, 10_000L)
    }
    private fun notification(): Notification {
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val stop = PendingIntent.getService(this, 1, Intent(this, HdsService::class.java).setAction("STOP"), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        return Notification.Builder(this, "hds-runtime").setSmallIcon(android.R.drawable.ic_menu_edit).setContentTitle("HDS 本机运行")
            .setContentText(HdsRuntime.get(this).notificationText()).setContentIntent(open).setOnlyAlertOnce(true).setOngoing(true)
            .addAction(Notification.Action.Builder(null, "停止全部", stop).build()).build()
    }
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "STOP") { intentionalStop = true; BackgroundPolicy(this).stop(); HdsRuntime.get(this).stopAsync(); stopSelf(); return START_NOT_STICKY }
        if (intent == null) { if (!BackgroundPolicy(this).wantsRestore()) { stopSelf(); return START_NOT_STICKY }; restoreIfAllowed() }
        return if (BackgroundPolicy(this).wantsRestore()) START_STICKY else START_NOT_STICKY
    }
    override fun onDestroy() { HdsRuntime.get(this).recordBackground("service-destroyed"); try { unregisterReceiver(powerReceiver) } catch (_: Exception) {}; try { network.unregisterNetworkCallback(networkCallback) } catch (_: Exception) {}; if (HdsRuntime.get(this).messagePush === push) HdsRuntime.get(this).messagePush = null; messageIo.shutdownNow(); handler.removeCallbacksAndMessages(null); wakeLock?.let { if (it.isHeld) it.release() }; if (active === this) active = null; if (!intentionalStop) HdsRuntime.get(this).stopAsync(); super.onDestroy() }
    override fun onBind(intent: Intent?): IBinder? = null
}
