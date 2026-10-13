package io.hdsinterlude.android

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.IBinder

class HdsService : Service() {
    override fun onCreate() {
        super.onCreate()
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel("hds-runtime", "HDS 本地运行", NotificationManager.IMPORTANCE_LOW))
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val stop = PendingIntent.getService(this, 1, Intent(this, HdsService::class.java).setAction("STOP"), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val notification = Notification.Builder(this, "hds-runtime").setSmallIcon(android.R.drawable.ic_menu_edit).setContentTitle("HDS 正在手机内运行").setContentText("点此返回；停止后自动叙事与主动联系结束").setContentIntent(open).setOngoing(true).addAction(Notification.Action.Builder(null, "停止 HDS", stop).build()).build()
        startForeground(42, notification)
    }
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "STOP") { HdsRuntime.get(this).stopAsync(); stopSelf() }
        return START_NOT_STICKY
    }
    override fun onDestroy() { HdsRuntime.get(this).stopAsync(); super.onDestroy() }
    override fun onBind(intent: Intent?): IBinder? = null
}
