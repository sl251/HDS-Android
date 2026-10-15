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
        fun stop(context: android.content.Context) {
            active?.intentionalStop = true
            context.stopService(Intent(context, HdsService::class.java))
        }
    }
    @Volatile private var intentionalStop = false
    private var wakeLock: PowerManager.WakeLock? = null
    private val handler = Handler(Looper.getMainLooper())
    private val health = object : Runnable { override fun run() {
        HdsRuntime.get(this@HdsService).refreshServiceHealth {
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
        if (intent?.action == "STOP") { intentionalStop = true; HdsRuntime.get(this).stopAsync(); stopSelf() }
        return START_NOT_STICKY
    }
    override fun onDestroy() { handler.removeCallbacksAndMessages(null); wakeLock?.let { if (it.isHeld) it.release() }; if (active === this) active = null; if (!intentionalStop) HdsRuntime.get(this).stopAsync(); super.onDestroy() }
    override fun onBind(intent: Intent?): IBinder? = null
}
