package com.voxel.vpn.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LogBusTest {
    @Test
    fun keepsOnlyTheNewestLinesAndNumbersThemInOrder() {
        val bus = LogBus(capacity = 3)
        for (i in 1..5) bus.info("t", "line $i")
        val lines = bus.lines.value
        assertEquals(listOf("line 3", "line 4", "line 5"), lines.map { it.text })
        assertEquals(listOf(3L, 4L, 5L), lines.map { it.id })
    }

    @Test
    fun blankMessagesAreIgnoredAndLongOnesTruncated() {
        val bus = LogBus()
        bus.info("t", "   ")
        bus.core("")
        bus.core(null)
        assertTrue(bus.lines.value.isEmpty())
        bus.info("t", "x".repeat(5000))
        assertEquals(2000, bus.lines.value.single().text.length)
    }

    @Test
    fun mirrorSeesEveryLineAndItsFailuresAreContained() {
        val seen = mutableListOf<String>()
        val bus = LogBus(mirror = { seen += "${it.level}:${it.tag}:${it.text}" })
        bus.warn("a", "one")
        bus.core("2026/11/04 10:00:00 [Error] boom")
        assertEquals(listOf("WARN:a:one", "ERROR:xray:boom"), seen)

        val broken = LogBus(mirror = { throw IllegalStateException("mirror down") })
        broken.info("t", "still recorded")
        assertEquals("still recorded", broken.lines.value.single().text)
    }

    @Test
    fun coreLinesLoseTheirTimestampAndGainALevel() {
        val bus = LogBus()
        bus.core("2026/11/04 10:00:00.123456 [Warning] app/dns: lookup failed")
        bus.core("2026/11/04 10:00:01 [Error] proxy: boom\r\n")
        bus.core("2026/11/04 10:00:02 [Info] started")
        bus.core("2026/11/04 10:00:03 [Debug] noisy")
        bus.core("something without any marker")
        val lines = bus.lines.value
        assertEquals(
            listOf(LogLevel.WARN, LogLevel.ERROR, LogLevel.INFO, LogLevel.DEBUG, LogLevel.INFO),
            lines.map { it.level },
        )
        assertEquals("app/dns: lookup failed", lines[0].text)
        assertEquals("proxy: boom", lines[1].text)
        assertEquals("started", lines[2].text)
        assertEquals("something without any marker", lines[4].text)
        assertTrue(lines.all { it.tag == "xray" })
    }

    @Test
    fun clearAndDump() {
        val bus = LogBus(clock = { 0L })
        bus.warn("vpn", "first")
        bus.error("vpn", "second")
        val dump = bus.dump()
        assertEquals(2, dump.lines().size)
        assertTrue(dump.lines()[0].contains(" W vpn: first"))
        assertTrue(dump.lines()[1].contains(" E vpn: second"))
        bus.clear()
        assertTrue(bus.lines.value.isEmpty())
    }
}
