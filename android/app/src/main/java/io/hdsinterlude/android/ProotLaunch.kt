package io.hdsinterlude.android

/** Probe the guest before sending credentials; degraded probes defer to main health checks. */
object ProotLaunch {
    const val PROBE_OK = "HDS_GUEST_PROBE_OK"
    fun guestArgs(probe: Boolean = false) = listOf("-w", "/opt/hds", "/opt/node/bin/node", if (probe) "/opt/hds/guest-probe.cjs" else "/opt/hds/host.cjs")

    // Process.pid() and Os.setpgid are not public APIs on our Android SDK.
    // Emit the group leader PID after setsid, before exec preserves that PID.
    const val PROBE_GROUP = "HDS_GUEST_PROBE_PGID="
    fun isolatedProbeArgs(args: List<String>) = listOf("/system/bin/setsid", "/system/bin/sh", "-c",
        "printf '${PROBE_GROUP}%s\\n' \"\$\$\"; exec \"\$@\"", "hds-probe") + args
    fun probeGroupId(line: String): Int? = if (line.startsWith(PROBE_GROUP)) line.removePrefix(PROBE_GROUP).toIntOrNull()?.takeIf { it > 1 } else null
    fun killProbeGroup(groupId: Int, kill: (Int) -> Unit) {
        // Never signal group 0 (the app's group), PID 1, or an unverified PID.
        if (groupId > 1) kill(-groupId)
    }

    data class ProbeResult(val exitCode: Int?, val timedOut: Boolean, val output: String, val degraded: Boolean = false) {
        val passed: Boolean get() = !degraded && !timedOut && exitCode == 0 && output.lineSequence().any { it.trim() == PROBE_OK }
    }
    fun selectProfile(probe: (Boolean) -> ProbeResult): Boolean {
        for (disableSeccomp in listOf(true, false)) {
            val result = probe(disableSeccomp)
            if (result.output.lineSequence().any { it.startsWith("HDS_GUEST_PROBE_FAILED stage=spawn") }) throw IllegalStateException("本机 Node 探测进程无法启动；请提供下方探测日志")
            // An unkillable probe is inconclusive. Avoid starting a second probe;
            // let the main launch's own timeout and health checks decide.
            check(!result.degraded) { "本机探测进程无法清理，已停止启动以避免残留进程；请重启应用并提供诊断" }
            if (result.passed) return disableSeccomp
        }
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
