package io.hdsinterlude.android

internal fun resolverConfig(systemDns: List<String>): String =
    (systemDns + listOf("223.5.5.5", "1.1.1.1")).joinToString("\n", postfix = "\n") { "nameserver $it" }
