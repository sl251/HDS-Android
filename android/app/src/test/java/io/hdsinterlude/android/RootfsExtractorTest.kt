package io.hdsinterlude.android

import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream
import org.apache.commons.compress.archivers.tar.TarConstants
import org.apache.commons.compress.compressors.gzip.GzipCompressorOutputStream
import org.junit.Assert.*
import org.junit.Test
import org.junit.Assume.assumeTrue
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.file.Files

class RootfsExtractorTest {
    private data class Item(val name: String, val text: String = "", val target: String = "", val kind: Byte = TarConstants.LF_NORMAL, val mode: Int = 493)
    private fun bundle(vararg items: Item): ByteArray {
        val bytes = ByteArrayOutputStream()
        TarArchiveOutputStream(GzipCompressorOutputStream(bytes)).use { tar ->
            for (item in items) {
                val entry = TarArchiveEntry(item.name, item.kind, true)
                entry.mode = item.mode; entry.linkName = item.target
                val content = item.text.toByteArray()
                entry.size = if (item.kind == TarConstants.LF_NORMAL) content.size.toLong() else 0
                tar.putArchiveEntry(entry)
                if (entry.isFile) tar.write(content)
                tar.closeArchiveEntry()
            }
        }
        return bytes.toByteArray()
    }
    private fun withRoot(action: (File) -> Unit) {
        val environment = Files.createTempDirectory("hds-extractor").toFile()
        val transaction = RuntimeTransaction(environment)
        transaction.prepare()
        try { action(transaction.staging) } finally { transaction.deleteOwned(transaction.staging); environment.delete() }
    }
    private fun extract(root: File, bytes: ByteArray, size: Long, cancel: () -> Boolean = { false }) = RootfsExtractor(
        { bytes.inputStream() }, { file, mode -> file.setExecutable(mode and 64 != 0, true) },
        { target, file -> Files.createSymbolicLink(file.toPath(), java.nio.file.Path.of(target)); Unit }, cancel
    ).extract(root, size)
    @Test fun materializesForwardChainsAndPreservesExecutableMode() = withRoot { root ->
        val bytes = bundle(Item("bin/alias", target = "./bin/next", kind = TarConstants.LF_LINK, mode = 0),
            Item("bin/next", target = "bin/original", kind = TarConstants.LF_LINK), Item("bin/original", "hello"))
        assertEquals(15L, extract(root, bytes, 15))
        assertEquals("hello", File(root, "bin/alias").readText())
        assertTrue(File(root, "bin/alias").canExecute())
        File(root, "bin/original").writeText("changed")
        assertEquals("hello", File(root, "bin/alias").readText())
    }
    @Test fun createsRelativeSymlinksAfterFiles() = withRoot { root ->
        extract(root, bundle(Item("bin/ref", target = "../lib/file", kind = TarConstants.LF_SYMLINK), Item("lib/file", "ok")), 2)
        assertTrue(Files.isSymbolicLink(File(root, "bin/ref").toPath()))
        assertEquals("ok", File(root, "bin/ref").readText())
    }
    private fun reject(vararg items: Item, quota: Long = 1) = withRoot { root ->
        assertThrows(Exception::class.java) { extract(root, bundle(*items), quota) }
        assertTrue("Validation must complete before writes", root.list()!!.isEmpty())
    }
    @Test fun rejectsMissingTarget() = reject(Item("alias", target = "missing", kind = TarConstants.LF_LINK))
    @Test fun rejectsHardlinkCycle() = reject(Item("a", target = "b", kind = TarConstants.LF_LINK), Item("b", target = "a", kind = TarConstants.LF_LINK))
    @Test fun rejectsHardlinkToDirectory() = reject(Item("a", target = "dir", kind = TarConstants.LF_LINK), Item("dir/", kind = TarConstants.LF_DIR))
    @Test fun rejectsHardlinkThroughSymlink() = reject(Item("a", target = "s", kind = TarConstants.LF_LINK), Item("s", target = "file", kind = TarConstants.LF_SYMLINK), Item("file", "x"))
    @Test fun rejectsTraversalAndAbsolutePaths() {
        reject(Item("../outside", "x")); reject(Item("/outside", "x"))
        reject(Item("a", target = "../outside", kind = TarConstants.LF_LINK))
        reject(Item("a", target = "../../outside", kind = TarConstants.LF_SYMLINK))
    }
    @Test fun rejectsSymlinkParentRegardlessOfOrder() = reject(Item("a/file", "x"), Item("a", target = "dir", kind = TarConstants.LF_SYMLINK))
    @Test fun rejectsDuplicateNormalizedPaths() = reject(Item("./file", "x"), Item("file", "x"), quota = 2)
    @Test fun countsHardlinkCopiesAgainstQuota() = reject(Item("file", "x"), Item("alias", target = "file", kind = TarConstants.LF_LINK), quota = 1)
    @Test fun rejectsSpecialEntries() = reject(Item("device", kind = TarConstants.LF_CHR))
    @Test fun cancellationDuringCopyLeavesNoCommittedFile() = withRoot { root ->
        var checks = 0
        val bytes = bundle(Item("file", "x".repeat(400000)))
        assertThrows(Exception::class.java) { extract(root, bytes, 400000) { ++checks > 9 } }
        assertFalse(File(root, "file").exists())
        assertTrue(root.list()!!.none { it.endsWith(".part") })
    }
    @Test fun truncatedGzipNeverCompletes() = withRoot { root ->
        val bytes = bundle(Item("file", "x".repeat(400000)))
        assertThrows(Exception::class.java) { extract(root, bytes.copyOf(bytes.size / 2), 400000) }
    }
    @Test fun extractsActualPreviewOneArchiveWhenProvided() {
        val path = System.getenv("HDS_LEGACY_ROOTFS")
        assumeTrue("Actual preview.1 archive supplied by CI", path != null)
        withRoot { root ->
            val extractor = RootfsExtractor({ File(path!!).inputStream() },
                { file, mode -> file.setExecutable(mode and 64 != 0, true) },
                { target, file -> Files.createSymbolicLink(file.toPath(), java.nio.file.Path.of(target)); Unit })
            assertEquals(318195691L, extractor.extract(root, 318195691))
            assertArrayEquals(File(root, "usr/bin/perl").readBytes(), File(root, "usr/bin/perl5.38.2").readBytes())
            assertEquals(File(root, "usr/bin/gunzip").readText(), File(root, "usr/bin/uncompress").readText())
            assertTrue(File(root, "usr/bin/perl5.38.2").canExecute())
            assertTrue(File(root, "opt/node/bin/node").isFile)
        }
    }
}
