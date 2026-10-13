package io.hdsinterlude.android

/** Both profiles are verified by the real guest before any credentials are sent. */
object ProotLaunch {
    const val PROBE_OK = "HDS_GUEST_PROBE_OK"
    fun guestArgs(probe: Boolean = false) = listOf("-w", "/opt/hds", "/opt/node/bin/node", if (probe) "/opt/hds/guest-probe.cjs" else "/opt/hds/host.cjs")

    data class ProbeResult(val exitCode: Int?, val timedOut: Boolean, val output: String) {
        val passed: Boolean get() = !timedOut && exitCode == 0 && output.lineSequence().any { it.trim() == PROBE_OK }
    }
    fun selectProfile(probe: (Boolean) -> ProbeResult): Boolean {
        for (disableSeccomp in listOf(true, false)) if (probe(disableSeccomp).passed) return disableSeccomp
        throw IllegalStateException("本机 Node 兼容性检查未通过；两种 PRoot 追踪模式均失败，请提供下方探测日志")
    }

    fun configure(environment: MutableMap<String, String>, nativeDir: String, temporary: String, disableSeccomp: Boolean = true) {
        if (disableSeccomp) environment["PROOT_NO_SECCOMP"] = "1" else environment.remove("PROOT_NO_SECCOMP")
        environment["PROOT_LOADER"] = "$nativeDir/libhds_loader.so"
        environment["PROOT_TMP_DIR"] = temporary
        // PRoot gets a host temporary directory; Node must not inherit an Android-only TMPDIR.
        environment.remove("TMPDIR")
        environment["LD_LIBRARY_PATH"] = ""
        environment["HOME"] = "/root"
        environment["PATH"] = "/opt/node/bin:/usr/bin:/bin"
        environment["LANG"] = "C.UTF-8"
        environment["OPENSSL_CONF"] = "/etc/ssl/openssl.cnf"
        environment["OPENSSL_MODULES"] = "/usr/lib/aarch64-linux-gnu/ossl-modules"
        environment["HDS_MOBILE_MAIN"] = "1"
    }
}
