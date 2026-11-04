package com.voxel.vpn.dpi

import com.voxel.vpn.core.LogLevel
import com.voxel.vpn.expectThrows
import com.voxel.vpn.model.AppSettings
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DpiModelTest {
    @Test
    fun modeIdsRoundTripAndUnknownIdsMeanOff() {
        DpiMode.entries.forEach { assertEquals(it, DpiMode.fromId(it.id)) }
        assertEquals(DpiMode.OFF, DpiMode.fromId(null))
        assertEquals(DpiMode.OFF, DpiMode.fromId(""))
        assertEquals(DpiMode.OFF, DpiMode.fromId("turbo"))
        assertEquals(DpiMode.OFF, DpiMode.fromId("Standard"))
    }

    @Test
    fun presetsHandTheEngineItsOwnPresetNames() {
        assertEquals("", DpiConfig(DpiMode.OFF, "split=1").strategy)
        assertEquals("light", DpiConfig(DpiMode.LIGHT, "ignored").strategy)
        assertEquals("standard", DpiConfig(DpiMode.STANDARD).strategy)
        assertEquals("strong", DpiConfig(DpiMode.STRONG).strategy)
        assertTrue(DpiConfig(DpiMode.STRONG).enabled)
        assertFalse(DpiConfig(DpiMode.OFF).enabled)
    }

    @Test
    fun customModeUsesTheTrimmedRecipeAndIsOffWhenItIsBlank() {
        assertEquals("split=1,sni+2", DpiConfig(DpiMode.CUSTOM, "  split=1,sni+2 \n").strategy)
        assertTrue(DpiConfig(DpiMode.CUSTOM, "split=1").enabled)
        assertFalse(DpiConfig(DpiMode.CUSTOM, "   ").enabled)
        assertFalse(DpiConfig(DpiMode.CUSTOM, "").enabled)
    }

    @Test
    fun settingsDecideTheConfig() {
        assertEquals(DpiConfig(DpiMode.OFF, ""), DpiConfig.of(AppSettings()))
        assertEquals(DpiConfig(DpiMode.CUSTOM, "oob=3"), DpiConfig.of(AppSettings(dpiMode = "custom", dpiCustom = "oob=3")))
        assertEquals(DpiConfig(DpiMode.OFF, "x"), DpiConfig.of(AppSettings(dpiMode = "nonsense", dpiCustom = "x")))
    }

    @Test
    fun settingsWrittenByEarlierVersionsStillLoad() {
        val json = Json { ignoreUnknownKeys = true }
        val old = json.decodeFromString(AppSettings.serializer(), """{"selectedServerId":"abc","ipv6":true,"logLevel":"info"}""")
        assertEquals("off", old.dpiMode)
        assertEquals("", old.dpiCustom)
        assertEquals("abc", old.selectedServerId)

        val roundTrip = Json { encodeDefaults = true }.encodeToString(AppSettings.serializer(), AppSettings(dpiMode = "strong", dpiCustom = "delay=5"))
        val back = json.decodeFromString(AppSettings.serializer(), roundTrip)
        assertEquals("strong", back.dpiMode)
        assertEquals("delay=5", back.dpiCustom)
    }

    @Test
    fun routeNeedsAUsablePortAndCredentials() {
        assertEquals(10808, DpiRoute(10808, "u", "p").port)
        expectThrows<IllegalArgumentException> { DpiRoute(0, "u", "p") }
        expectThrows<IllegalArgumentException> { DpiRoute(65536, "u", "p") }
        expectThrows<IllegalArgumentException> { DpiRoute(80, "", "p") }
        expectThrows<IllegalArgumentException> { DpiRoute(80, "u", "") }
    }

    @Test
    fun statsComeFromTheEnginesCounterArray() {
        val stats = DpiStats.from(longArrayOf(10, 2, 9, 7, 1, 5000, 90000))
        assertEquals(DpiStats(accepted = 10, active = 2, connected = 9, desynced = 7, failed = 1, bytesUp = 5000, bytesDown = 90000), stats)
        assertEquals(DpiStats(), DpiStats.from(null))
        assertEquals(DpiStats(), DpiStats.from(longArrayOf(1, 2, 3)))
        // Extra elements from a newer engine are ignored.
        assertEquals(10L, DpiStats.from(longArrayOf(10, 0, 0, 0, 0, 0, 0, 99)).accepted)
    }

    @Test
    fun startReplyGivesThePortOrTheEnginesError() {
        assertEquals(41234, DpiProtocol.parseStart("OK:41234"))
        assertEquals(1, DpiProtocol.parseStart("OK: 1 "))
        assertEquals("bind: Address already in use", expectThrows<DpiException> { DpiProtocol.parseStart("ERR:bind: Address already in use") }.message)
        assertEquals("unknown error", expectThrows<DpiException> { DpiProtocol.parseStart("ERR:") }.message)
        expectThrows<DpiException> { DpiProtocol.parseStart("OK:0") }
        expectThrows<DpiException> { DpiProtocol.parseStart("OK:70000") }
        expectThrows<DpiException> { DpiProtocol.parseStart("OK:abc") }
        expectThrows<DpiException> { DpiProtocol.parseStart("") }
        expectThrows<DpiException> { DpiProtocol.parseStart("hello") }
    }

    @Test
    fun checkReplyIsEitherTheCanonicalRecipeOrTheReason() {
        assertEquals(DpiCheck.Valid("split=1,sni+2"), DpiProtocol.parseCheck("OK:split=1,sni+2"))
        assertEquals(DpiCheck.Invalid("unknown option 'foo'"), DpiProtocol.parseCheck("ERR:unknown option 'foo'"))
        assertEquals(DpiCheck.Invalid("garbage"), DpiProtocol.parseCheck("garbage"))
    }

    @Test
    fun hostsAreFormattedForTheEngine() {
        val hosts = mapOf(
            "b.example.com" to listOf("198.51.100.2", "2001:db8::2"),
            "a.example.com" to listOf("198.51.100.1"),
        )
        assertEquals("a.example.com=198.51.100.1;b.example.com=198.51.100.2,2001:db8::2", DpiProtocol.hostsParam(hosts))
        assertEquals("", DpiProtocol.hostsParam(emptyMap()))
    }

    @Test
    fun hostsThatWouldBreakTheFormatAreLeftOut() {
        val hosts = mapOf(
            "empty.example.com" to emptyList(),
            "blank.example.com" to listOf(" "),
            "bad name" to listOf("198.51.100.3"),
            "semi;colon" to listOf("198.51.100.4"),
            "eq=uals" to listOf("198.51.100.5"),
            "" to listOf("198.51.100.6"),
            "mixed.example.com" to listOf("198.51.100.7", "1.2.3.4;evil=9.9.9.9", "198.51.100.8"),
        )
        assertEquals("mixed.example.com=198.51.100.7,198.51.100.8", DpiProtocol.hostsParam(hosts))
    }

    @Test
    fun logLinesKeepTheirLevel() {
        val lines = DpiProtocol.parseLog("I|listening on 127.0.0.1:4000\nW|slow connect\nE|bind failed\nD|chunk 1 of 3")
        assertEquals(
            listOf(
                DpiLogLine(LogLevel.INFO, "listening on 127.0.0.1:4000"),
                DpiLogLine(LogLevel.WARN, "slow connect"),
                DpiLogLine(LogLevel.ERROR, "bind failed"),
                DpiLogLine(LogLevel.DEBUG, "chunk 1 of 3"),
            ),
            lines,
        )
    }

    @Test
    fun malformedLogLinesAreDropped() {
        assertEquals(emptyList<DpiLogLine>(), DpiProtocol.parseLog(""))
        assertEquals(emptyList<DpiLogLine>(), DpiProtocol.parseLog("no marker here\nX|unknown level\nI|\nI\n|text"))
        assertEquals(listOf(DpiLogLine(LogLevel.INFO, "a|b")), DpiProtocol.parseLog("junk\nI|a|b\n"))
    }
}
