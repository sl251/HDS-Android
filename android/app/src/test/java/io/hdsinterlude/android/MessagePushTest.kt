package io.hdsinterlude.android

import org.junit.Assert.*
import org.junit.Test

class MessagePushTest {
    @Test fun parsesOnlyCompleteProtocolLines() {
        val json = """{"id":"message-1","content":"第一行","fullContent":"第一行\n后文","occurredAt":"2026-10-16T10:00:00Z"}"""
        val message = parseMessagePush("HDS_MSG_PUSH $json")!!
        assertEquals("message-1", message.id)
        assertEquals("第一行\n后文", message.fullContent)
        for (line in listOf(json, "prefix HDS_MSG_PUSH $json", "HDS_MSG_PUSH {", "HDS_MSG_PUSH {}", "HDS_MSG_PUSH ${json.replace("2026-10-16T10:00:00Z", "invalid")}", "HDS_MOBILE_READY")) assertNull(line, parseMessagePush(line))
        assertEquals("第一行", parseMessagePush("HDS_MSG_PUSH ${json.replace(",\"fullContent\":\"第一行\\n后文\"", "")}")!!.fullContent)
    }
}
