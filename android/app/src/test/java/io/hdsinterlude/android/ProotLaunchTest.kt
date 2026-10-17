package io.hdsinterlude.android

import org.junit.Assert.*
import org.junit.Test
import org.junit.Assume.assumeTrue
import java.io.File
import java.util.concurrent.TimeUnit

class ProotLaunchTest {
    @Test fun probeWrapperPreservesArgumentsAndEmitsARealGroupLeader() {
        // Execute the wrapper on Unix hosts; Android uses the same setsid/sh
        // protocol, with /system/bin paths supplied by isolatedProbeArgs.
        val setsid = listOf("/usr/bin/setsid", "/bin/setsid").firstOrNull { File(it).canExecute() }
        assumeTrue(setsid != null && File("/bin/sh").canExecute() && File("/proc/self/stat").isFile)
        val args = ProotLaunch.isolatedProbeArgs(listOf("/bin/sh", "-c",
            "read pid comm state parent group rest < /proc/\$\$/stat; printf '%s\\n%s\\n' \"\$group\" \"\$1\"", "probe", "argument with spaces")).toMutableList()
        args[0] = setsid!!; args[1] = "/bin/sh"
        val child = ProcessBuilder(args).redirectErrorStream(true).start()
        try {
            assertTrue(child.waitFor(5, TimeUnit.SECONDS))
            val lines = child.inputStream.bufferedReader().readLines()
            assertEquals(0, child.exitValue())
            assertEquals(3, lines.size)
            val group = ProotLaunch.probeGroupId(lines[0])
            assertNotNull(group)
            assertEquals(group.toString(), lines[1])
            assertEquals("argument with spaces", lines[2])
        } finally { child.destroyForcibly() }
    }

    @Test fun isolatesProbeAndKillsOnlyItsVerifiedProcessGroup() {
        val args = listOf("/native/libhds_proot.so", "argument with spaces") + ProotLaunch.guestArgs(true)
        val isolated = ProotLaunch.isolatedProbeArgs(args)
        assertEquals(listOf("/system/bin/setsid", "/system/bin/sh", "-c"), isolated.take(3))
        assertTrue(isolated[3].contains("exec \"\$@\""))
        assertEquals(args, isolated.drop(5))
        val killed = mutableListOf<Int>()
        assertEquals(1234, ProotLaunch.probeGroupId("${ProotLaunch.PROBE_GROUP}1234"))
        for (line in listOf("1234", "${ProotLaunch.PROBE_GROUP}0", "${ProotLaunch.PROBE_GROUP}-10", "${ProotLaunch.PROBE_GROUP}1", "${ProotLaunch.PROBE_GROUP}oops")) assertNull(ProotLaunch.probeGroupId(line))
        for (pid in listOf(0, 1, -1, 1234)) ProotLaunch.killProbeGroup(pid) { killed.add(it) }
        assertEquals(listOf(-1234), killed)
    }

    @Test fun unkillableProbeStopsBeforeStartingMoreProcesses() {
        val attempts = mutableListOf<Boolean>()
        val result = ProotLaunch.ProbeResult(null, true, "HDS_GUEST_PROBE_WARNING stage=cleanup degraded=true", degraded = true)
        assertFalse(result.passed)
        assertThrows(IllegalStateException::class.java) { ProotLaunch.selectProfile { attempts.add(it); result } }
        assertEquals(listOf(true), attempts)
        var calls = 0
        assertThrows(IllegalStateException::class.java) {
            ProotLaunch.selectProfile { calls++; ProotLaunch.ProbeResult(null, false, "HDS_GUEST_PROBE_FAILED stage=spawn code=IOException", degraded = true) }
        }
        assertEquals(1, calls)
    }

    @Test fun preservesMainLaunchEnvironmentAndSeparatesHostTemporaryDirectory() {
        val environment = mutableMapOf("TMPDIR" to "/android/cache", "LD_LIBRARY_PATH" to "/host/lib")
        ProotLaunch.configure(environment, "/native", "/cache/proot")
        assertEquals("1", environment["PROOT_NO_SECCOMP"])
        assertEquals("/native/libhds_loader.so", environment["PROOT_LOADER"])
        assertEquals("/cache/proot", environment["PROOT_TMP_DIR"])
        assertFalse(environment.containsKey("TMPDIR"))
        assertEquals("", environment["LD_LIBRARY_PATH"])
        assertEquals("/etc/ssl/openssl.cnf", environment["OPENSSL_CONF"])
        assertEquals("/usr/lib/aarch64-linux-gnu/ossl-modules", environment["OPENSSL_MODULES"])
        assertEquals("1", environment["HDS_MOBILE_MAIN"])
    }

    @Test fun startsNodeDirectlyInGuestWorkingDirectory() {
        val args = ProotLaunch.guestArgs()
        assertEquals("/opt/hds", args[args.indexOf("-w") + 1])
        assertFalse(args.contains("/usr/bin/env"))
        assertEquals(listOf("/opt/node/bin/node", "/opt/hds/host.cjs"), args.takeLast(2))
    }

    @Test fun retriesEnosysWithAccelerationAndRemovesInheritedDisableFlag() {
        val attempts = mutableListOf<Boolean>()
        val selected = ProotLaunch.selectProfile { disabled ->
            attempts.add(disabled)
            if (disabled) ProotLaunch.ProbeResult(1, false, "ENOSYS uv_cwd")
            else ProotLaunch.ProbeResult(0, false, ProotLaunch.PROBE_OK)
        }
        assertFalse(selected)
        assertEquals(listOf(true, false), attempts)
        val environment = mutableMapOf("PROOT_NO_SECCOMP" to "1")
        ProotLaunch.configure(environment, "/native", "/tmp", selected)
        assertFalse(environment.containsKey("PROOT_NO_SECCOMP"))
    }

    @Test fun retainsWorkingLegacyProfileAndRequiresExitAndActualProbeMarker() {
        var calls = 0
        assertTrue(ProotLaunch.selectProfile { calls++; ProotLaunch.ProbeResult(0, false, ProotLaunch.PROBE_OK) })
        assertEquals(1, calls)
        for (result in listOf(ProotLaunch.ProbeResult(0, false, "Node v24"), ProotLaunch.ProbeResult(1, false, ProotLaunch.PROBE_OK), ProotLaunch.ProbeResult(0, true, ProotLaunch.PROBE_OK))) {
            assertFalse(result.passed)
            assertThrows(IllegalStateException::class.java) { ProotLaunch.selectProfile { result } }
        }
    }
}
