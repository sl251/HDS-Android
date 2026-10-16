package io.hdsinterlude.android

import android.content.Context
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

/** Original bytes stay private and animated. Only a JPEG proxy enters the existing image RPC. */
class StickerStore(private val context: Context) {
    private val root = File(context.noBackupFilesDir, "hds/stickers").apply { mkdirs() }
    private val filename = Regex("[a-f0-9]{64}\\.(gif|png|webp|jpg)")
    private fun displayName(uri: Uri): String = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null } ?: "我的表情"

    fun import(uris: List<Uri>, tree: Uri? = null): JSONObject {
        val assets = JSONArray()
        var skipped = 0
        fun copy(uri: Uri) {
            val temporary = File.createTempFile("import-", ".tmp", root)
            try {
                val digest = MessageDigest.getInstance("SHA-256")
                var size = 0L
                context.contentResolver.openInputStream(uri)?.use { input -> temporary.outputStream().use { output ->
                    val block = ByteArray(65536)
                    while (true) {
                        val count = input.read(block)
                        if (count < 0) break
                        size += count
                        require(size <= 10L * 1024 * 1024) { "贴纸文件最大10MiB" }
                        digest.update(block, 0, count); output.write(block, 0, count)
                    }
                } } ?: throw IllegalArgumentException("无法读取图片")
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeFile(temporary.absolutePath, bounds)
                val extension = mapOf("image/gif" to "gif", "image/png" to "png", "image/webp" to "webp", "image/jpeg" to "jpg")[bounds.outMimeType]
                require(extension != null && bounds.outWidth > 0 && bounds.outHeight > 0 && bounds.outWidth.toLong() * bounds.outHeight <= 100_000_000)
                val id = digest.digest().joinToString("") { "%02x".format(it) }
                val destination = File(root, "$id.$extension")
                if (!destination.exists()) check(temporary.renameTo(destination)) { "贴纸复制失败" }
                assets.put(JSONObject().put("id", id).put("path", destination.absolutePath).put("size", size).put("mime", bounds.outMimeType))
            } catch (_: Exception) { skipped++ } finally { temporary.delete() }
        }
        if (tree != null) {
            val pending = java.util.ArrayDeque<String>()
            val visited = mutableSetOf<String>()
            pending.add(DocumentsContract.getTreeDocumentId(tree))
            while (pending.isNotEmpty()) {
                val id = pending.removeFirst()
                if (!visited.add(id)) continue
                val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, id)
                context.contentResolver.query(children, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_MIME_TYPE), null, null, null)?.use { cursor ->
                    while (cursor.moveToNext()) {
                        val child = cursor.getString(0)
                        if (cursor.getString(1) == DocumentsContract.Document.MIME_TYPE_DIR) pending.add(child)
                        else copy(DocumentsContract.buildDocumentUriUsingTree(tree, child))
                    }
                } ?: throw IllegalArgumentException("无法读取文件夹")
            }
        } else uris.forEach { copy(it) }
        val name = if (tree != null) displayName(DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))) else "我的表情"
        return JSONObject().put("cancelled", false).put("name", name).put("assets", assets).put("skipped", skipped)
    }

    /** Metadata only: WebView owns pack edits; message-only originals are not part of the catalog. */
    fun saveLibrary(packs: JSONArray) {
        val clean = JSONArray()
        for (index in 0 until packs.length()) {
            val pack = packs.getJSONObject(index)
            val ids = pack.getJSONArray("ids")
            require((0 until ids.length()).all { Regex("[a-f0-9]{64}").matches(ids.getString(it)) }) { "无效贴纸编号" }
            clean.put(JSONObject().put("id", pack.getString("id")).put("name", pack.getString("name")).put("ids", ids))
        }
        val file = File(root.parentFile, "sticker-library.json")
        val temporary = File(root.parentFile, "sticker-library.json.tmp")
        temporary.writeText(clean.toString())
        check(temporary.renameTo(file)) { "表情包清单保存失败" }
    }

    /** Called with the runtime stopped. Replace only the disposable export, never originals/history. */
    fun exportTo(dataDir: File): Int {
        val manifest = File(root.parentFile, "sticker-library.json")
        val packs = if (manifest.exists()) JSONArray(manifest.readText()) else JSONArray()
        val staging = File(dataDir, ".stickers-next")
        val previous = File(dataDir, ".stickers-previous")
        val destination = File(dataDir, "stickers")
        // Recover an interrupted swap before preparing the next snapshot.
        if (!destination.exists() && previous.exists()) check(previous.renameTo(destination))
        staging.deleteRecursively(); check(staging.mkdirs())
        var count = 0
        val groups = mutableSetOf<String>()
        try {
            for (index in 0 until packs.length()) {
                val pack = packs.getJSONObject(index)
                val name = pack.getString("name").map { if (it == '/' || it == '\\' || it == ':' || it.isISOControl()) '_' else it }.joinToString("").trim().take(80).ifEmpty { "我的表情" }
                val base = if (name == "." || name == "..") "我的表情" else name
                var group = base
                var suffix = 2
                while (!groups.add(group)) { group = "$base (${suffix++})" }
                val ids = pack.getJSONArray("ids")
                for (asset in 0 until ids.length()) {
                    val id = ids.getString(asset)
                    require(Regex("[a-f0-9]{64}").matches(id)) { "无效贴纸编号" }
                    val source = root.listFiles()?.firstOrNull { filename.matches(it.name) && it.name.startsWith("$id.") }
                        ?: throw IllegalArgumentException("表情包原件已移除，请重新导入")
                    val folder = File(staging, group).apply { mkdirs() }
                    source.copyTo(File(folder, source.name), overwrite = true)
                    count++
                }
            }
            previous.deleteRecursively()
            if (destination.exists()) check(destination.renameTo(previous)) { "表情包旧快照移动失败" }
            if (!staging.renameTo(destination)) {
                previous.renameTo(destination)
                error("表情包同步失败")
            }
            previous.deleteRecursively()
            return count
        } finally { staging.deleteRecursively() }
    }

    fun image(id: String): JSONObject {
        require(Regex("[a-f0-9]{64}").matches(id)) { "无效贴纸编号" }
        val file = root.listFiles()?.firstOrNull { filename.matches(it.name) && it.name.startsWith("$id.") } ?: throw IllegalArgumentException("贴纸文件已移除")
        return JSONObject().put("dataUri", AppearanceStore(context).image(Uri.fromFile(file)))
    }
    fun prune(keep: Set<String>) {
        require(keep.all { Regex("[a-f0-9]{64}").matches(it) })
        root.listFiles()?.filter { filename.matches(it.name) && it.name.substringBefore('.') !in keep }?.forEach { check(it.delete()) { "贴纸文件清理失败" } }
    }
}
