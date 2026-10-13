package io.hdsinterlude.android

import java.io.File
import java.nio.file.Files
import java.nio.file.LinkOption.NOFOLLOW_LINKS
import java.nio.file.Path
import java.nio.file.attribute.BasicFileAttributes

/** The manifest lives inside each generation, so one rename switches files and marker. */
class RuntimeTransaction(
    private val environment: File,
    private val beforeDelete: (File) -> Unit = {},
    private val rename: (File, File) -> Boolean = { a, b -> a.renameTo(b) }
) {
    val root = File(environment, "rootfs")
    val staging = File(environment, "staging")
    val previous = File(environment, "previous")
    fun deleteOwned(file: File) {
        require(file.parentFile.canonicalFile == environment.canonicalFile && file.name in listOf("staging", "previous"))
        beforeDelete(file)
        if (!Files.exists(file.toPath(), NOFOLLOW_LINKS)) return
        fun remove(path: Path) {
            val attrs = Files.readAttributes(path, BasicFileAttributes::class.java, NOFOLLOW_LINKS)
            if (attrs.isDirectory) {
                // A finished/cancelled archive may have made owned directories read-only.
                val directory = path.toFile()
                if (!directory.setReadable(true, true) || !directory.setWritable(true, true) || !directory.setExecutable(true, true)) {
                    throw java.io.IOException("无法恢复托管临时目录权限")
                }
                Files.newDirectoryStream(path).use { children -> for (child in children) remove(child) }
            }
            Files.delete(path)
        }
        remove(file.toPath())
    }
    fun recover() {
        if (!Files.exists(root.toPath(), NOFOLLOW_LINKS) && Files.exists(previous.toPath(), NOFOLLOW_LINKS)) {
            require(rename(previous, root)) { "无法恢复上次运行环境" }
        }
    }
    fun prepare() { recover(); deleteOwned(staging); require(staging.mkdirs()) { "无法创建安装目录" } }
    fun activate(): Boolean {
        require(File(staging, ".hds-installed.json").isFile) { "暂存环境尚未验证" }
        deleteOwned(previous)
        if (root.exists()) require(rename(root, previous)) { "无法保留旧运行环境" }
        if (!rename(staging, root)) {
            if (previous.exists()) require(rename(previous, root)) { "切换失败且无法恢复旧环境" }
            throw IllegalStateException("无法切换运行环境，已保留旧版本")
        }
        // A cleanup failure never invalidates the newly committed generation.
        return try { deleteOwned(previous); true } catch (_: java.io.IOException) { false }
    }
}
