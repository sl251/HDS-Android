package io.hdsinterlude.android

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.file.Files
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class StoryArchiveTest {
    private val id = "a".repeat(64)
    private fun setup(root: File): File {
        File(root, "cards").mkdirs()
        File(root, "cards/$id.json").writeText(JSONObject().put("id", id).put("card", JSONObject().put("name", "测试角色")).toString())
        File(root, "cards/$id.source").writeText("original card")
        val profile = File(root, "profiles/$id").apply { mkdirs() }
        File(profile, "hds.sqlite").writeBytes("SQLite format 3\u0000fixture".toByteArray())
        File(profile, "qq-policy.json").writeText("{\"enabled\":false}")
        File(profile, "images").mkdirs(); File(profile, "images/example.jpg").writeBytes(byteArrayOf(1, 2, 3))
        return profile
    }
    @Test fun archiveRoundTripPreservesImagesAndChecksums() {
        val root = Files.createTempDirectory("hds-archive").toFile()
        try {
            setup(root); val archive = StoryArchive(root); val output = ByteArrayOutputStream(); archive.export(id, output)
            val stage = archive.stage(id, ByteArrayInputStream(output.toByteArray()))
            assertArrayEquals(byteArrayOf(1, 2, 3), File(stage, "profile/images/example.jpg").readBytes())
            assertThrows(IllegalArgumentException::class.java) { archive.stage("b".repeat(64), ByteArrayInputStream(output.toByteArray())) }
        } finally { root.deleteRecursively() }
    }
    @Test fun resetAndCrashRecoveryRestoreOriginalProfile() {
        val root = Files.createTempDirectory("hds-reset").toFile()
        try {
            val profile = setup(root); val archive = StoryArchive(root); archive.replace(id)
            assertFalse(File(profile, "hds.sqlite").exists()); assertTrue(File(profile, "qq-policy.json").exists())
            StoryArchive(root).recover()
            assertTrue(File(profile, "hds.sqlite").exists()); assertTrue(File(profile, "images/example.jpg").exists())
            assertFalse(File(root, "story-operation.json").exists())
        } finally { root.deleteRecursively() }
    }
    @Test fun committedResetRetainsBackupAndOtherProfiles() {
        val root = Files.createTempDirectory("hds-reset-commit").toFile()
        try {
            val profile = setup(root); val other = File(root, "profiles/${"b".repeat(64)}").apply { mkdirs() }; File(other, "keep").writeText("other story")
            val archive = StoryArchive(root); val backup = archive.replace(id); archive.commit(); archive.recover()
            assertFalse(File(profile, "hds.sqlite").exists()); assertTrue(File(root, "story-backups/$id/$backup/profile/hds.sqlite").exists()); assertEquals("other story", File(other, "keep").readText())
        } finally { root.deleteRecursively() }
    }
    @Test fun traversalAndDuplicateEntriesAreRejected() {
        val root = Files.createTempDirectory("hds-bad-archive").toFile()
        try {
            setup(root)
            for (path in listOf("profile/../../outside", "profile/evil\\path", "unlisted.txt")) {
                val output = ByteArrayOutputStream(); ZipOutputStream(output).use { it.putNextEntry(ZipEntry(path)); it.write(byteArrayOf(1)); it.closeEntry() }
                assertThrows(IllegalArgumentException::class.java) { StoryArchive(root).stage(id, ByteArrayInputStream(output.toByteArray())) }
            }
            assertFalse(File(root.parentFile, "outside").exists())
        } finally { root.deleteRecursively() }
    }
}
