package io.hdsinterlude.android

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Test
import java.io.File

class ImageSelectionTest {
    @Test fun selectedPhotoIsCompressedWithoutZeroSampleDivision() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val photo = File(context.cacheDir, "preview7-image-test.jpg")
        val bitmap = Bitmap.createBitmap(1600, 1200, Bitmap.Config.ARGB_8888)
        try {
            bitmap.eraseColor(android.graphics.Color.BLUE)
            photo.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, 90, it) }
            val uri = AppearanceStore(context).image(Uri.fromFile(photo))
            assertTrue(uri.startsWith("data:image/jpeg;base64,"))
            val bytes = Base64.decode(uri.substringAfter(','), Base64.DEFAULT)
            assertTrue(bytes.size <= 480000)
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
            assertEquals(1024, bounds.outWidth)
            assertEquals(768, bounds.outHeight)
        } finally { bitmap.recycle(); photo.delete() }
    }
}
