package io.hdsinterlude.android

import org.junit.Assert.*
import org.junit.Test

class ProotLaunchTest {
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
