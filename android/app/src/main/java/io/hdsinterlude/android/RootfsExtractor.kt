package io.hdsinterlude.android

import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.gzip.GzipCompressorInputStream
import java.io.File
import java.io.InputStream
import java.nio.file.Files
import java.nio.file.LinkOption.NOFOLLOW_LINKS
import java.util.concurrent.CancellationException

/** Two passes over a verified, immutable asset. No links exist during file writes. */
class RootfsExtractor(
    private val open: () -> InputStream,
    private val chmod: (File, Int) -> Unit,
    private val symlink: (String, File) -> Unit,
    private val cancelled: () -> Boolean = { false },
    private val progress: (Long, Int) -> Unit = { _, _ -> }
) {
    data class Entry(val name: String, val kind: String, val size: Long, val mode: Int, val target: String)
    class Failure(val operation: String, val entry: String, val target: String, val bytesWritten: Long, cause: Throwable) :
        java.io.IOException("$operation: $entry", cause)
    private var written = 0L
    private fun checkCancel() { if (cancelled()) throw CancellationException("安装已取消") }
    private fun <T> at(operation: String, entry: Entry, action: () -> T): T = try {
        checkCancel(); action()
    } catch (failure: Throwable) {
        throw Failure(operation, entry.name, entry.target, written, failure)
    }
    private fun path(raw: String): String {
        require(raw.isNotEmpty() && raw.length <= 4096 && !raw.startsWith('/') && !raw.contains('\u0000') && !raw.contains('\\')) { "无效归档路径" }
        val parts = raw.split('/').filter { it.isNotEmpty() && it != "." }
        require(parts.size <= 128 && parts.none { it == ".." }) { "归档路径越界或过深" }
        return parts.joinToString("/")
    }
    private fun symbolicTarget(entry: Entry): String {
        val target = entry.target
        require(target.isNotEmpty() && target.length <= 4096 && !target.startsWith('/') && !target.contains('\u0000') && !target.contains('\\')) { "无效符号链接" }
        val parts = entry.name.substringBeforeLast('/', "").split('/').filter { it.isNotEmpty() }.toMutableList()
        for (part in target.split('/')) when (part) {
            "", "." -> Unit
            ".." -> { require(parts.isNotEmpty()) { "符号链接越界" }; parts.removeAt(parts.lastIndex) }
            else -> parts.add(part)
        }
        return parts.joinToString("/")
    }
    private fun validateSymbolicChain(entry: Entry, entries: Map<String, Entry>) {
        val parts = entry.name.substringBeforeLast('/', "").split('/').filter { it.isNotEmpty() }.toMutableList()
        val pending = ArrayDeque(entry.target.split('/'))
        var expansions = 0
        while (pending.isNotEmpty()) when (val part = pending.removeFirst()) {
            "", "." -> Unit
            ".." -> { require(parts.isNotEmpty()) { "符号链接链越界" }; parts.removeAt(parts.lastIndex) }
            else -> {
                parts.add(part)
                val link = entries[parts.joinToString("/")]
                if (link?.kind == "symbolic") {
                    require(++expansions <= 256) { "符号链接循环或链过长" }
                    symbolicTarget(link)
                    parts.removeAt(parts.lastIndex)
                    for (token in link.target.split('/').asReversed()) pending.addFirst(token)
                }
            }
        }
    }
    private fun archive(action: (TarArchiveInputStream) -> Unit) {
        open().use { input -> GzipCompressorInputStream(input).use { gzip -> TarArchiveInputStream(gzip).use(action) } }
    }
    @Suppress("DEPRECATION")
    private fun next(tar: TarArchiveInputStream): Entry? {
        val source = tar.nextTarEntry ?: return null
        return Entry(path(source.name), when {
            source.isSparse -> "unsupported"
            source.isDirectory -> "directory"
            source.isSymbolicLink -> "symbolic"
            source.isLink -> "hard"
            source.isFile -> "file"
            else -> "unsupported"
        }, source.size, source.mode and 511, source.linkName)
    }
    fun extract(root: File, quota: Long): Long {
        require(quota in 1..(4L * 1024 * 1024 * 1024)) { "无效解包配额" }
        require(root.isDirectory && root.list()?.isEmpty() == true) { "暂存目录必须为空" }
        written = 0
        val entries = linkedMapOf<String, Entry>()
        archive { tar ->
            var roots = 0
            var fileBytes = 0L
            while (true) {
                checkCancel()
                val entry = next(tar) ?: break
                if (entry.name.isEmpty()) { require(entry.kind == "directory" && ++roots == 1); continue }
                at("index", entry) {
                    require(entries.size < 80000 && entries.putIfAbsent(entry.name, entry) == null) { "重复或过多归档条目" }
                    require(entry.kind != "unsupported") { "不支持的特殊条目" }
                    require(entry.size in 0..512L * 1024 * 1024 && (entry.kind == "file" || entry.size == 0L)) { "无效条目长度" }
                    if (entry.kind == "file") { fileBytes += entry.size; require(fileBytes <= quota) { "归档大小超限" } }
                }
            }
        }
        val resolved = mutableMapOf<String, Entry>()
        fun resolve(entry: Entry): Entry {
            resolved[entry.name]?.let { return it }
            var current = entry
            val seen = mutableSetOf<String>()
            while (current.kind == "hard") {
                require(seen.add(current.name) && seen.size <= 256) { "硬链接循环或链过长" }
                current = entries[path(current.target)] ?: throw IllegalArgumentException("硬链接缺少目标")
            }
            require(current.kind == "file") { "硬链接目标不是普通文件" }
            resolved[entry.name] = current
            return current
        }
        var expected = 0L
        for (entry in entries.values) at("validate", entry) {
            var parent = entry.name.substringBeforeLast('/', "")
            while (parent.isNotEmpty()) {
                require(entries[parent]?.kind.let { it == null || it == "directory" }) { "父路径不是目录" }
                parent = parent.substringBeforeLast('/', "")
            }
            when (entry.kind) {
                "file" -> expected += entry.size
                "hard" -> expected += resolve(entry).size
                "symbolic" -> { symbolicTarget(entry); validateSymbolicChain(entry, entries) }
            }
            require(expected <= quota) { "解包总大小超限" }
        }
        require(expected == quota) { "归档长度与清单不一致" }
        fun destination(entry: Entry): File = File(root, entry.name).also {
            require(it.toPath().normalize().startsWith(root.toPath().normalize()))
            require(it.parentFile.isDirectory || it.parentFile.mkdirs()) { "无法创建父目录" }
        }
        fun copy(entry: Entry, input: InputStream, size: Long, mode: Int) {
            val target = destination(entry)
            require(!Files.exists(target.toPath(), NOFOLLOW_LINKS)) { "目标已存在" }
            val temporary = Files.createTempFile(target.parentFile.toPath(), ".hds-", ".part").toFile()
            try {
                temporary.outputStream().use { output ->
                    var remaining = size
                    val buffer = ByteArray(131072)
                    while (remaining > 0) {
                        checkCancel()
                        val count = input.read(buffer, 0, minOf(remaining, buffer.size.toLong()).toInt())
                        require(count > 0) { "归档文件被截断" }
                        output.write(buffer, 0, count); remaining -= count; written += count
                        require(written <= quota) { "解包总大小超限" }
                    }
                }
                chmod(temporary, mode)
                require(temporary.renameTo(target)) { "无法提交文件" }
            } finally { temporary.delete() }
        }
        archive { tar ->
            var count = 0
            while (true) {
                checkCancel()
                val entry = next(tar) ?: break
                if (entry.name.isEmpty()) continue
                at("extract", entry) {
                    require(entries[entry.name] == entry) { "两次读取的归档不同" }
                    when (entry.kind) {
                        "directory" -> { val dir = destination(entry); require(dir.isDirectory || dir.mkdirs()) }
                        "file" -> copy(entry, tar, entry.size, entry.mode)
                    }
                    if (++count % 100 == 0) progress(written, count)
                }
            }
            require(count == entries.size)
        }
        for (entry in entries.values.filter { it.kind == "hard" }) at("copy-hardlink", entry) {
            val original = resolved.getValue(entry.name)
            File(root, original.name).inputStream().use { copy(entry, it, original.size, original.mode) }
        }
        for (entry in entries.values.filter { it.kind == "symbolic" }) at("symlink", entry) {
            val target = destination(entry)
            require(!Files.exists(target.toPath(), NOFOLLOW_LINKS))
            symlink(entry.target, target)
        }
        for (entry in entries.values.filter { it.kind == "directory" }.sortedByDescending { it.name.length }) at("chmod-directory", entry) {
            chmod(File(root, entry.name), entry.mode)
        }
        require(written == expected) { "解包写入长度不一致" }
        return written
    }
}
