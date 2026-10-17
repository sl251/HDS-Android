package io.hdsinterlude.android

import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.json.JSONObject
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class VoiceBridgeQueueTest {
    @Test fun concurrentProviderCallsCannotHideBehindTheLoopbackTimeoutAndOverflowIsExplicit() {
        val entered = CountDownLatch(2); val release = CountDownLatch(1); val pool = Executors.newFixedThreadPool(3)
        val card = "a".repeat(64)
        VoiceBridge(RuntimeEnvironment.getApplication(), "fixture-token", card) { body ->
            assertEquals(card, body.getString("cardId")); assertFalse(body.getBoolean("preview"))
            entered.countDown(); assertTrue(release.await(5, TimeUnit.SECONDS)); JSONObject().put("status", "generated")
        }.use { bridge ->
            fun request(): JSONObject {
                val c = java.net.URL(bridge.url).openConnection() as java.net.HttpURLConnection
                try {
                    c.requestMethod = "POST"; c.doOutput = true; c.readTimeout = 6000
                    c.setRequestProperty("Authorization", "Bearer fixture-token")
                    c.outputStream.use { it.write("{\"cardId\":\"untrusted\",\"preview\":true}".toByteArray()) }
                    return JSONObject(c.inputStream.bufferedReader().use { it.readText() })
                } finally { c.disconnect() }
            }
            try {
                val a = pool.submit<JSONObject> { request() }; val b = pool.submit<JSONObject> { request() }
                assertTrue(entered.await(3, TimeUnit.SECONDS))
                val overflow = pool.submit<JSONObject> { request() }.get(2, TimeUnit.SECONDS)
                assertEquals("skipped", overflow.getString("status")); assertEquals("queue_full", overflow.getString("reason"))
                release.countDown(); assertEquals("generated", a.get(3, TimeUnit.SECONDS).getString("status")); assertEquals("generated", b.get(3, TimeUnit.SECONDS).getString("status"))
            } finally { release.countDown(); pool.shutdownNow() }
        }
    }
}
