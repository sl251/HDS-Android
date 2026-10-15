package io.hdsinterlude.android

import android.content.Context
import android.content.ContextWrapper
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.media.ExifInterface
import android.net.Uri
import android.util.Base64
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.io.RandomAccessFile

/** Device-only Bitmap/EXIF/ContentResolver checks. These do not measure PSS or prove OEM picker behavior. */
class ImageDecodeTest {
    private fun isolated(test: (Context, File) -> Unit) {
        val base = ApplicationProvider.getApplicationContext<Context>()
        val work = File(base.cacheDir, "decode-test-${System.nanoTime()}").apply { mkdirs() }
        val context = object : ContextWrapper(base) {
            override fun getCacheDir() = File(work, "cache").apply { mkdirs() }
            override fun getNoBackupFilesDir() = File(work, "private").apply { mkdirs() }
        }
        try { test(context, work) } finally { work.deleteRecursively() }
    }
    private fun photo(file: File, width: Int = 1200, height: Int = 800, format: Bitmap.CompressFormat = Bitmap.CompressFormat.JPEG) {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        try {
            val canvas = Canvas(bitmap); val paint = Paint()
            val colors = intArrayOf(Color.RED, Color.GREEN, Color.BLUE, Color.YELLOW)
            for (index in colors.indices) {
                paint.color = colors[index]
                val x = (index % 2) * width / 2f; val y = (index / 2) * height / 2f
                canvas.drawRect(x, y, x + width / 2f, y + height / 2f, paint)
            }
            file.outputStream().use { assertTrue(bitmap.compress(format, 95, it)) }
        } finally { bitmap.recycle() }
    }
    private fun decoded(store: AppearanceStore, file: File): Bitmap {
        val data = store.image(Uri.fromFile(file))
        val bytes = Base64.decode(data.substringAfter(','), Base64.DEFAULT)
        assertTrue(bytes.size <= 480000)
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: throw AssertionError("decode failed")
    }
    private fun clean(context: Context) = assertFalse(context.cacheDir.listFiles().orEmpty().any { it.name.startsWith("hds-image-") })
    @Test fun allExifDirectionsPreserveCornersAndReleaseTemporaryFiles() = isolated { context, work ->
        val expected = arrayOf(intArrayOf(0,1,2,3), intArrayOf(1,0,3,2), intArrayOf(3,2,1,0), intArrayOf(2,3,0,1), intArrayOf(0,2,1,3), intArrayOf(2,0,3,1), intArrayOf(3,1,2,0), intArrayOf(1,3,0,2))
        val colors = intArrayOf(Color.RED, Color.GREEN, Color.BLUE, Color.YELLOW)
        for (orientation in 1..8) {
            val file = File(work, "exif-$orientation.jpg"); photo(file)
            ExifInterface(file.absolutePath).apply { setAttribute(ExifInterface.TAG_ORIENTATION, orientation.toString()); saveAttributes() }
            val bitmap = decoded(AppearanceStore(context), file)
            try {
                assertTrue(maxOf(bitmap.width, bitmap.height) <= 1024)
                assertEquals(orientation in 5..8, bitmap.height > bitmap.width)
                for (index in 0..3) {
                    val actual = bitmap.getPixel(if (index % 2 == 0) 10 else bitmap.width - 11, if (index < 2) 10 else bitmap.height - 11)
                    val color = colors[expected[orientation - 1][index]]
                    assertTrue(kotlin.math.abs(Color.red(actual) - Color.red(color)) < 60)
                    assertTrue(kotlin.math.abs(Color.green(actual) - Color.green(color)) < 60)
                    assertTrue(kotlin.math.abs(Color.blue(actual) - Color.blue(color)) < 60)
                }
            } finally { bitmap.recycle() }
            clean(context)
        }
    }
    @Suppress("DEPRECATION")
    @Test fun largeAndSequentialPhotosPngWebpAndBackgroundStayBounded() = isolated { context, work ->
        val store = AppearanceStore(context)
        for ((index, format) in listOf(Bitmap.CompressFormat.JPEG, Bitmap.CompressFormat.PNG, Bitmap.CompressFormat.WEBP).withIndex()) {
            val file = File(work, "photo-$index"); photo(file, 4000, 3000, format)
            repeat(3) { val bitmap = decoded(store, file); try { assertTrue(maxOf(bitmap.width, bitmap.height) <= 1024) } finally { bitmap.recycle() }; clean(context) }
            store.import("background", Uri.fromFile(file))
            val background = File(store.read().getString("backgroundPath"))
            assertTrue(background.length() <= 1500000)
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }; BitmapFactory.decodeFile(background.absolutePath, bounds)
            assertTrue(maxOf(bounds.outWidth, bounds.outHeight) <= 2048); clean(context)
        }
    }
    @Test fun runtimeLogRedactsSyntheticSecretsAndBoundsLines() {
        val safe = sanitizedRuntimeLog("\u001b[31mTEST_KEY_PLACEHOLDER TEST_TOKEN_PLACEHOLDER " + "x".repeat(2000), listOf("TEST_KEY_PLACEHOLDER"), "TEST_TOKEN_PLACEHOLDER")
        assertEquals(1500, safe.length)
        assertFalse(safe.contains("TEST_KEY_PLACEHOLDER")); assertFalse(safe.contains("TEST_TOKEN_PLACEHOLDER")); assertFalse(safe.contains("\u001b"))
    }
    @Test fun transparentPngKeepsTheExistingJpegBackgroundPolicy() = isolated { context, work ->
        val source = File(work, "transparent.png")
        val original = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888)
        try { original.eraseColor(Color.TRANSPARENT); source.outputStream().use { original.compress(Bitmap.CompressFormat.PNG, 100, it) } } finally { original.recycle() }
        val bitmap = decoded(AppearanceStore(context), source)
        try { assertEquals(Color.BLACK, bitmap.getPixel(32, 32)) } finally { bitmap.recycle() }
        clean(context)
    }
    @Test fun invalidAndOverLimitSourcesAreRejectedAndCleaned() = isolated { context, work ->
        val store = AppearanceStore(context)
        val corrupt = File(work, "corrupt.jpg").apply { writeBytes(byteArrayOf(1,2,3,4)) }
        val huge = File(work, "over-limit.jpg"); RandomAccessFile(huge, "rw").use { it.setLength(32L * 1024 * 1024 + 1) }
        for (file in listOf(corrupt, huge)) {
            try { store.image(Uri.fromFile(file)); fail("invalid file accepted") } catch (_: IllegalArgumentException) { }
            clean(context)
        }
        val valid = File(work, "valid.jpg"); photo(valid)
        decoded(store, valid).recycle(); clean(context)
    }
}
