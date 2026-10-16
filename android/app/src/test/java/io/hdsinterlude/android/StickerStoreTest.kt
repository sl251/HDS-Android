package io.hdsinterlude.android

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.content.pm.ProviderInfo
import android.database.Cursor
import android.database.MatrixCursor
import android.graphics.Bitmap
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.GraphicsMode
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowContentResolver
import java.io.File
import java.io.ByteArrayOutputStream

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class StickerStoreTest {
    private lateinit var context: Context
    private lateinit var provider: StickerDocuments
    @Before fun setup() {
        context = RuntimeEnvironment.getApplication()
        File(context.noBackupFilesDir, "hds/stickers").deleteRecursively()
        provider = StickerDocuments()
        provider.attachInfo(context, ProviderInfo().apply { authority = "hds.sticker.fixture" })
        ShadowContentResolver.registerProviderInternal("hds.sticker.fixture", provider)
    }
    private fun png(): ByteArray {
        val bitmap = Bitmap.createBitmap(4, 4, Bitmap.Config.ARGB_8888)
        val output = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, output); bitmap.recycle()
        return output.toByteArray()
    }
    @Test fun safRecursesNamesFolderCopiesOriginalAndCountsUnsupported() {
        val bytes = png()
        provider.files["one"] = bytes; provider.files["two"] = bytes; provider.files["bad"] = "unsupported".toByteArray()
        val tree = Uri.parse("content://hds.sticker.fixture/tree/root")
        val store = StickerStore(context)
        val result = store.import(emptyList(), tree)
        assertEquals("开心包", result.getString("name"))
        assertEquals(2, result.getJSONArray("assets").length())
        assertEquals(1, result.getInt("skipped"))
        val asset = result.getJSONArray("assets").getJSONObject(0)
        assertArrayEquals(bytes, File(asset.getString("path")).readBytes())
        assertArrayEquals(bytes, provider.files["one"])
        assertEquals(1, File(context.noBackupFilesDir, "hds/stickers").listFiles()!!.size)
        assertTrue(store.image(asset.getString("id")).getString("dataUri").startsWith("data:image/jpeg;base64,"))
        store.prune(setOf(asset.getString("id")))
        assertTrue(File(asset.getString("path")).exists())
        store.prune(emptySet())
        assertFalse(File(asset.getString("path")).exists())
        assertArrayEquals(bytes, provider.files["one"])
    }
    @Test fun gifOriginalSurvivesImportAndFileIdentifiersCannotEscapePrivateDirectory() {
        val gif = android.util.Base64.decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", 0)
        provider.files["gif"] = gif
        val store = StickerStore(context)
        val asset = store.import(listOf(Uri.parse("content://hds.sticker.fixture/document/gif"))).getJSONArray("assets").getJSONObject(0)
        assertEquals("image/gif", asset.getString("mime"))
        assertArrayEquals(gif, File(asset.getString("path")).readBytes())
        assertThrows(IllegalArgumentException::class.java) { store.image("../appearance/settings.json") }
        assertThrows(IllegalArgumentException::class.java) { store.prune(setOf("../bad")) }
    }
}

class StickerDocuments : ContentProvider() {
    val files = mutableMapOf<String, ByteArray>()
    override fun onCreate() = true
    override fun getType(uri: Uri) = "image/png"
    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, args: Array<out String>?, sort: String?): Cursor {
        val columns = projection ?: arrayOf(OpenableColumns.DISPLAY_NAME)
        val cursor = MatrixCursor(columns)
        if (uri.lastPathSegment == "children") {
            val id = DocumentsContract.getDocumentId(uri)
            val entries = if (id == "root") listOf("one" to "image/png", "nested" to DocumentsContract.Document.MIME_TYPE_DIR) else listOf("two" to "image/png", "bad" to "text/plain")
            for ((child, mime) in entries) cursor.addRow(columns.map { if (it == DocumentsContract.Document.COLUMN_DOCUMENT_ID) child else mime })
        } else cursor.addRow(columns.map { "开心包" })
        return cursor
    }
    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor {
        val file = File(context!!.cacheDir, "source-${uri.lastPathSegment}")
        file.writeBytes(files.getValue(uri.lastPathSegment!!))
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
    }
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, args: Array<out String>?) = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, args: Array<out String>?) = 0
}
