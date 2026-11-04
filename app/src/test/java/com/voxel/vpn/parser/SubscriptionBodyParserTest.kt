package com.voxel.vpn.parser

import com.voxel.vpn.Samples
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SubscriptionBodyParserTest {
    private val parser = SubscriptionBodyParser(clock = { 1_700_000_000_000L })
    private val ws = Samples.VLESS_WS_TLS
    private val reality = Samples.VLESS_REALITY

    private fun b64(text: String) = Base64Codec.encodeStandard(text.toByteArray())

    @Test
    fun base64BodyWithLinks() {
        val parsed = parser.parse(b64("$reality\n$ws\nssr://abc\n"))
        assertEquals(listOf("Reality NL", "WS CDN"), parsed.servers.map { it.name })
        assertEquals(1, parsed.skipped.size)
        assertTrue(parsed.skipped.first().reason.contains("ShadowsocksR"))
        assertEquals(1_700_000_000_000L, parsed.servers.first().addedAt)
    }

    @Test
    fun urlSafeBase64WithoutPaddingAndCrLf() {
        val body = Base64Codec.encodeUrlSafe("$reality\r\n$ws\r\n".toByteArray())
        assertEquals(2, parser.parse(body).servers.size)
    }

    @Test
    fun plainLinesAndInlineMetadata() {
        val description = "My Sub\nSecond line"
        val body = """
            #profile-title: base64:${b64(description)}
            #profile-update-interval: 12
            #subscription-userinfo: upload=100; download=200; total=1000; expire=1893456000
            #support-url: https://t.me/support
            #profile-web-page-url: https://example.com
            #announce: base64:${b64("Hello announce")}
            // just a comment
            $reality
            $ws
        """.trimIndent()
        val parsed = parser.parse(body)
        assertEquals(2, parsed.servers.size)
        val meta = parsed.meta
        assertEquals("My Sub", meta.title)
        assertEquals("Second line", meta.description)
        assertEquals(12, meta.updateIntervalHours)
        assertEquals(100L, meta.userInfo!!.upload)
        assertEquals(200L, meta.userInfo!!.download)
        assertEquals(300L, meta.userInfo!!.used)
        assertEquals(1000L, meta.userInfo!!.total)
        assertEquals(1893456000L, meta.userInfo!!.expireAt)
        assertEquals("https://t.me/support", meta.supportUrl)
        assertEquals("https://example.com", meta.webPageUrl)
        assertEquals("Hello announce", meta.announce)
        assertTrue(parsed.skipped.isEmpty())
    }

    @Test
    fun metadataInsideBase64Body() {
        val parsed = parser.parse(b64("#profile-title: Inner\n$reality"))
        assertEquals("Inner", parsed.meta.title)
        assertEquals(1, parsed.servers.size)
    }

    @Test
    fun headersBeatInlineMetadata() {
        val parsed = parser.parse(
            "#profile-title: Inline\n#support-url: https://inline.example\n$reality",
            mapOf("profile-title" to "Header", "Profile-Update-Interval" to "6"),
        )
        assertEquals("Header", parsed.meta.title)
        assertEquals("https://inline.example", parsed.meta.supportUrl)
        assertEquals(6, parsed.meta.updateIntervalHours)
    }

    @Test
    fun titleFromBase64HeaderSubscriptionNameAndContentDisposition() {
        assertEquals("\u0422\u0435\u0441\u0442", parser.parse(reality, mapOf("profile-title" to "base64:" + b64("\u0422\u0435\u0441\u0442"))).meta.title)
        assertEquals("Named", parser.parse(reality, mapOf("subscription-name" to "Named")).meta.title)
        assertEquals("Fast VPN", parser.parse(reality, mapOf("content-disposition" to "attachment; filename=\"Fast VPN.txt\"")).meta.title)
        assertEquals("Utf Name", parser.parse(reality, mapOf("content-disposition" to "attachment; filename*=UTF-8''Utf%20Name.yaml")).meta.title)
        assertNull(parser.parse(reality).meta.title)
    }

    @Test
    fun userInfoVariants() {
        val hidden = parser.parse(reality, mapOf("subscription-userinfo" to "0")).meta
        assertTrue(hidden.hideTraffic)
        assertNull(hidden.userInfo)

        val ms = parser.parse(reality, mapOf("subscription-userinfo" to "upload=1;download=2;total=3;expire=1893456000000")).meta
        assertEquals(1893456000L, ms.userInfo!!.expireAt)

        val noExpire = parser.parse(reality, mapOf("subscription-userinfo" to "upload=1; download=2; total=3; expire=0")).meta
        assertNull(noExpire.userInfo!!.expireAt)

        val decimals = parser.parse(reality, mapOf("subscription-userinfo" to "upload=1.5e3; download=2; total=3")).meta
        assertEquals(1500L, decimals.userInfo!!.upload)

        assertNull(parser.parse(reality, mapOf("subscription-userinfo" to "garbage")).meta.userInfo)
    }

    @Test
    fun extraHeadersAreKeptAndNoiseIsNot() {
        val meta = parser.parse(
            reality,
            mapOf(
                "fragmentation-enable" to "1", "noises-type" to "rand", "per-app-proxy-list" to "a,b", "content-type" to "text/plain",
                "sort-order" to "PING", "hide-url" to "true", "announce-url" to "https://x.example", "support-email" to "a@b.c",
                "routing" to "base64payload", "profile-update-interval" to "0.2",
            ),
        ).meta
        assertEquals(mapOf("fragmentation-enable" to "1", "noises-type" to "rand", "per-app-proxy-list" to "a,b"), meta.extra)
        assertEquals("ping", meta.sortOrder)
        assertTrue(meta.hideUrl)
        assertEquals("https://x.example", meta.announceUrl)
        assertEquals("a@b.c", meta.supportEmail)
        assertEquals("base64payload", meta.routing)
        assertEquals(1, meta.updateIntervalHours)
    }

    @Test
    fun routingDirectivesAreCollectedNotParsedAsServers() {
        val body = "$reality\nincy://routing/onadd/QUJD\n://routing/add/REVG\n://autorouting/onadd/https://x.example/r\n://onadd/R0hJ\nhapp://routing/R0hJ"
        val parsed = parser.parse(body)
        assertEquals(1, parsed.servers.size)
        assertEquals(5, parsed.routing.size)
        assertEquals(listOf(true, false, true, true, false), parsed.routing.map { it.activate })
        assertEquals(listOf(false, false, true, false, false), parsed.routing.map { it.auto })
        assertTrue(parsed.skipped.isEmpty())
    }

    @Test
    fun jsonArrayOfXrayConfigs() {
        val config = { remarks: String, id: String ->
            """{"remarks":"$remarks","outbounds":[
                {"tag":"proxy","protocol":"vless","settings":{"vnext":[{"address":"203.0.113.5","port":443,"users":[{"id":"$id","encryption":"none","flow":"xtls-rprx-vision"}]}]},
                 "streamSettings":{"network":"tcp","security":"reality","realitySettings":{"serverName":"a.b","publicKey":"${Samples.REALITY_PBK}","shortId":"ab","fingerprint":"chrome"}}},
                {"tag":"direct","protocol":"freedom"},{"tag":"block","protocol":"blackhole"}]}"""
        }
        val parsed = parser.parse("[${config("Node A", "a")},${config("Node B", "b")}]")
        assertEquals(listOf("Node A", "Node B"), parsed.servers.map { it.name })
        val first = parsed.servers.first()
        assertEquals("vless", first.protocol)
        assertEquals("203.0.113.5", first.host)
        assertEquals(443, first.port)
        assertEquals("reality", first.security)
        assertNull(first.outbound["tag"])
        assertTrue(parsed.skipped.isEmpty())
    }

    @Test
    fun singleConfigWithSeveralProxyOutbounds() {
        val body = """{"outbounds":[
            {"tag":"one","protocol":"trojan","settings":{"servers":[{"address":"t1.example.com","port":443,"password":"p"}]},"streamSettings":{"network":"tcp","security":"tls"}},
            {"tag":"two","protocol":"shadowsocks","settings":{"servers":[{"address":"1.1.1.1","port":8388,"method":"aes-256-gcm","password":"p"}]}},
            {"tag":"direct","protocol":"freedom"}]}"""
        val parsed = parser.parse(body)
        assertEquals(listOf("one", "two"), parsed.servers.map { it.name })
        assertEquals("shadowsocks", parsed.servers[1].protocol)
    }

    @Test
    fun jsonOutboundsAreSanitisedForTheStrictCore() {
        val body = """[
          {"remarks":"h2","outbounds":[{"protocol":"vless","settings":{"address":"h.example.com","port":443,"id":"x","encryption":"none"},"streamSettings":{"network":"h2","security":"tls"}}]},
          {"remarks":"insecure","outbounds":[{"protocol":"vless","settings":{"address":"i.example.com","port":443,"id":"x","encryption":"none"},"streamSettings":{"network":"ws","security":"tls","tlsSettings":{"allowInsecure":true,"serverName":"i.example.com"}}}]},
          {"remarks":"nofp","outbounds":[{"protocol":"vless","settings":{"address":"r.example.com","port":443,"id":"x","encryption":"none"},"streamSettings":{"network":"tcp","security":"reality","realitySettings":{"serverName":"a.b","publicKey":"${Samples.REALITY_PBK}","shortId":""}}}]},
          {"remarks":"plain","outbounds":[{"protocol":"trojan","settings":{"address":"203.0.113.1","port":443,"password":"p"}}]},
          {"remarks":"chain","outbounds":[{"protocol":"vless","settings":{"address":"c.example.com","port":443,"id":"x","encryption":"none"},"streamSettings":{"network":"tcp","security":"tls"},"proxySettings":{"tag":"other"}}]},
          {"remarks":"only direct","outbounds":[{"protocol":"freedom"}]}
        ]"""
        val parsed = parser.parse(body)
        assertEquals(listOf("insecure", "nofp"), parsed.servers.map { it.name })
        val tls = parsed.servers[0].outbound["streamSettings"]!!.jsonObject["tlsSettings"]!!.jsonObject
        assertNull(tls["allowInsecure"])
        assertEquals("i.example.com", tls["serverName"]!!.jsonPrimitive.content)
        val reality = parsed.servers[1].outbound["streamSettings"]!!.jsonObject["realitySettings"]!!.jsonObject
        assertEquals("chrome", reality["fingerprint"]!!.jsonPrimitive.content)
        assertEquals(4, parsed.skipped.size)
        assertTrue(parsed.skipped.any { it.source == "h2" && it.reason.contains("removed") })
        assertTrue(parsed.skipped.any { it.source == "plain" && it.reason.contains("without TLS") })
        assertTrue(parsed.skipped.any { it.source == "chain" && it.reason.contains("Chained") })
        assertTrue(parsed.skipped.any { it.source == "only direct" })
        assertTrue(parsed.warnings.any { it.contains("allowInsecure") })
    }

    @Test
    fun amneziaWgJsonIsSkipped() {
        val parsed = parser.parse("""{"type":"amneziawg","servers":[{"name":"a","config":"abc"}]}""")
        assertTrue(parsed.servers.isEmpty())
        assertTrue(parsed.skipped.single().reason.contains("WireGuard"))
    }

    @Test
    fun jsonArrayOfLinkStrings() {
        val parsed = parser.parse("[\"$reality\",\"$ws\"]")
        assertEquals(2, parsed.servers.size)
    }

    @Test
    fun duplicatesAreCollapsed() {
        val parsed = parser.parse("$reality\n${reality.replace("#Reality%20NL", "#Copy")}\n$ws")
        assertEquals(listOf("Reality NL", "WS CDN"), parsed.servers.map { it.name })
    }

    @Test
    fun garbageProducesNoServersButSkippedEntries() {
        val parsed = parser.parse("hello\nworld\nftp://x.example/f\n")
        assertTrue(parsed.servers.isEmpty())
        assertEquals(3, parsed.skipped.size)
        assertEquals(0, parser.parse("").servers.size)
        assertEquals(0, parser.parse("   \n \n").skipped.size)
    }

    @Test
    fun byteOrderMarkAndOneBadLineDoNotBreakTheImport() {
        val parsed = parser.parse("\uFEFF$reality\nvless://broken\n$ws")
        assertEquals(2, parsed.servers.size)
        assertEquals(1, parsed.skipped.size)
        assertFalse(parsed.skipped.single().source.isEmpty())
    }

    @Test
    fun longSkippedPreviewsAreTruncated() {
        val parsed = parser.parse("ssr://" + "a".repeat(300))
        assertTrue(parsed.skipped.single().source.length <= 49)
    }

    @Test
    fun theEmulatorTestSubscriptionImportsAsPlainVlessToTheHostMachine() {
        val link = "vless://5783a3e7-e373-51cd-8642-c83782b807c5@10.0.2.2:10443?encryption=none&security=none&type=tcp#E2E%20server"
        val body = "#profile-title: VOXEL E2E\n" +
            "#subscription-userinfo: upload=1048576; download=5242880; total=10737418240; expire=1893456000\n" +
            link + "\n"
        val parsed = parser.parse(body)
        val server = parsed.servers.single()
        assertEquals("E2E server", server.name)
        assertEquals("10.0.2.2", server.host)
        assertEquals(10443, server.port)
        assertEquals("vless", server.protocol)
        assertEquals("VOXEL E2E", parsed.meta.title)
        assertEquals(10_737_418_240L, parsed.meta.userInfo!!.total)
        assertTrue(parsed.skipped.isEmpty())
    }

    @Test
    fun plainVlessToAPublicAddressIsSkippedBecauseXrayRefusesIt() {
        val link = "vless://5783a3e7-e373-51cd-8642-c83782b807c5@203.0.113.7:10443?encryption=none&security=none&type=tcp#Open"
        val parsed = parser.parse(link)
        assertTrue(parsed.servers.isEmpty())
        assertTrue(parsed.skipped.single().reason.contains("VLESS"))
    }
}
