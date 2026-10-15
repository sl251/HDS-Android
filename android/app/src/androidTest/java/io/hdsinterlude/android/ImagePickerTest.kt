package io.hdsinterlude.android

import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.net.Uri
import androidx.activity.result.ActivityResult
import org.junit.Assert.*
import org.junit.Test

class ImagePickerTest {
    @Test fun singleClipAndMixedSelectionsKeepStableUniqueUriOrder() {
        val first = Uri.parse("content://fixture/first")
        val second = Uri.parse("content://fixture/second")
        val single = Intent().setData(first)
        assertEquals(listOf(first), pickedImageUris(ActivityResult(Activity.RESULT_OK, single)))
        val clip = ClipData.newRawUri("images", first).apply { addItem(ClipData.Item(second)); addItem(ClipData.Item(first)) }
        val mixed = Intent().setData(second).apply { clipData = clip }
        assertEquals(listOf(first, second), pickedImageUris(ActivityResult(Activity.RESULT_OK, mixed)))
        assertTrue(pickedImageUris(ActivityResult(Activity.RESULT_CANCELED, mixed)).isEmpty())
        assertTrue(pickedImageUris(ActivityResult(Activity.RESULT_OK, Intent())).isEmpty())
    }
}
