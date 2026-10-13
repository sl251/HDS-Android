package io.hdsinterlude.android

import android.system.Os
import androidx.test.platform.app.InstrumentationRegistry
import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream
import org.apache.commons.compress.archivers.tar.TarConstants
import org.apache.commons.compress.compressors.gzip.GzipCompressorOutputStream
import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.io.File

/** Executes in the application's UID, never needs hardlink permission. */
class RuntimeInstallTest {
    @Test fun installsLegacyHardlinkAsIndependentExecutableFile() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val environment = File(context.noBackupFilesDir, "extractor-test-${java.util.UUID.randomUUID()}").apply { mkdir() }
        val transaction = RuntimeTransaction(environment)
        transaction.prepare()
        try {
            val bytes = ByteArrayOutputStream()
            TarArchiveOutputStream(GzipCompressorOutputStream(bytes)).use { tar ->
                val alias = TarArchiveEntry("bin/alias", TarConstants.LF_LINK).apply { linkName = "bin/file"; mode = 493 }
                tar.putArchiveEntry(alias); tar.closeArchiveEntry()
                val file = TarArchiveEntry("bin/file").apply { size = 2; mode = 493 }
                tar.putArchiveEntry(file); tar.write(byteArrayOf(79, 75)); tar.closeArchiveEntry()
            }
            val result = RootfsExtractor({ bytes.toByteArray().inputStream() },
                { file, mode -> Os.chmod(file.absolutePath, mode) },
                { target, file -> Os.symlink(target, file.absolutePath) }).extract(transaction.staging, 4)
            assertEquals(4L, result)
            assertEquals("OK", File(transaction.staging, "bin/alias").readText())
            assertTrue(File(transaction.staging, "bin/alias").canExecute())
            assertNotEquals(Os.stat(File(transaction.staging, "bin/file").absolutePath).st_ino,
                Os.stat(File(transaction.staging, "bin/alias").absolutePath).st_ino)
        } finally { transaction.deleteOwned(transaction.staging); environment.delete() }
    }
    @Test fun diagnosticIncludesDeviceAndSeparateFileCapabilitiesWithoutPersonalData() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val report = HdsRuntime.get(context).diagnosticReport(true)
        assertTrue(report.getJSONObject("device").has("webview"))
        assertTrue(report.getJSONObject("fileCapabilities").getJSONObject("regular").getBoolean("success"))
        assertTrue(report.getJSONObject("fileCapabilities").has("hardlink"))
        assertEquals("unavailable", report.getString("avc"))
        for (key in listOf("settings", "logs", "apiKey", "cards", "messages", "encryptedKey")) assertFalse(report.has(key))
    }
}
