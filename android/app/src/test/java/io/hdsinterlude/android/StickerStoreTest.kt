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
    @Test fun exportGroupsOriginalsAndReplacesSnapshotWithoutDeletingHistoryOrLibrary() {
        val bytes = png()
        provider.files["one"] = bytes
        val store = StickerStore(context)
        val asset = store.import(listOf(Uri.parse("content://hds.sticker.fixture/document/one"))).getJSONArray("assets").getJSONObject(0)
        val id = asset.getString("id")
        val data = File(context.cacheDir, "m4-profile").apply { deleteRecursively(); mkdirs() }
        val history = File(data, "images/$id.png").apply { parentFile!!.mkdirs(); writeBytes(bytes) }
        val packs = org.json.JSONArray().put(org.json.JSONObject().put("id", "first").put("name", "开心包").put("ids", org.json.JSONArray().put(id)))
        store.saveLibrary(packs)
        // A new instance models startup after WebView metadata synchronization.
        assertEquals(1, StickerStore(context).exportTo(data))
        assertArrayEquals(bytes, File(data, "stickers/开心包/$id.png").readBytes())
        store.saveLibrary(org.json.JSONArray())
        assertEquals(0, store.exportTo(data))
        assertTrue(File(data, "stickers").listFiles()!!.isEmpty())
        assertArrayEquals(bytes, history.readBytes())
        assertArrayEquals(bytes, File(asset.getString("path")).readBytes())
    }

    @Test fun registeredMediaRpcCanReadLargeOriginalStickerDataUri() {
        // Runtime registers original bytes as an images.get media ID, including animated GIFs.
        val runtime = HdsRuntime.get(context)
        val socket = java.net.ServerSocket(0, 1, java.net.InetAddress.getByName("127.0.0.1"))
        val worker = java.util.concurrent.Executors.newSingleThreadExecutor()
        val uri = "data:image/gif;base64," + "A".repeat(4 * 1024 * 1024)
        val body = org.json.JSONObject().put("data", org.json.JSONObject().put("dataUri", uri)).toString().toByteArray()
        val exchange = worker.submit {
            socket.accept().use { client ->
                client.soTimeout = 10000
                val reader = client.getInputStream().bufferedReader()
                var length = 0
                while (true) {
                    val line = reader.readLine() ?: error("Missing headers")
                    if (line.isEmpty()) break
                    if (line.startsWith("Content-Length:", ignoreCase = true)) length = line.substringAfter(':').trim().toInt()
                }
                val request = CharArray(length); var offset = 0
                while (offset < length) { val read = reader.read(request, offset, length - offset); check(read > 0); offset += read }
                assertEquals("images.get", org.json.JSONObject(String(request)).getString("method"))
                client.getOutputStream().use { output ->
                    output.write("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${body.size}\r\nConnection: close\r\n\r\n".toByteArray())
                    output.write(body); output.flush()
                }
            }
        }
        fun field(name: String, value: Any) { HdsRuntime::class.java.getDeclaredField(name).apply { isAccessible = true }.set(runtime, value) }
        try {
            field("port", socket.localPort); field("token", "test-only-token")
            val result = runtime.rpc("images.get", org.json.JSONObject().put("id", "a".repeat(64)))
            assertEquals(uri, result.getJSONObject("data").getString("dataUri"))
            exchange.get(15, java.util.concurrent.TimeUnit.SECONDS)
        } finally { field("port", 0); field("token", ""); socket.close(); exchange.cancel(true); worker.shutdownNow() }
    }

    @Test fun exportGifBytesUsesSafeUniqueGroupsAndRejectsTraversalIds() {
        val bytes = android.util.Base64.decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", 0)
        provider.files["gif"] = bytes
        val store = StickerStore(context)
        val id = store.import(listOf(Uri.parse("content://hds.sticker.fixture/document/gif"))).getJSONArray("assets").getJSONObject(0).getString("id")
        val data = File(context.cacheDir, "m4-gif").apply { deleteRecursively(); mkdirs() }
        fun pack(name: String) = org.json.JSONObject().put("id", name).put("name", name).put("ids", org.json.JSONArray().put(id))
        store.saveLibrary(org.json.JSONArray().put(pack("../开心")).put(pack("../开心")))
        assertEquals(2, store.exportTo(data))
        val exported = File(data, "stickers").walkTopDown().filter { it.isFile }.toList()
        assertEquals(2, exported.size)
        exported.forEach { assertArrayEquals(bytes, it.readBytes()); assertTrue(it.canonicalPath.startsWith(File(data, "stickers").canonicalPath + "/")) }
        assertThrows(IllegalArgumentException::class.java) {
            store.saveLibrary(org.json.JSONArray().put(org.json.JSONObject().put("id", "bad").put("name", "bad").put("ids", org.json.JSONArray().put("../bad"))))
        }
        // Failed sync must preserve the last complete export.
        store.saveLibrary(org.json.JSONArray().put(org.json.JSONObject().put("id", "missing").put("name", "missing").put("ids", org.json.JSONArray().put("0".repeat(64)))))
        assertThrows(IllegalArgumentException::class.java) { store.exportTo(data) }
        exported.forEach { assertTrue(it.exists()) }
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
