package com.voxel.vpn.core

import com.voxel.vpn.Samples
import com.voxel.vpn.model.ServerProfile
import com.voxel.vpn.parser.Base64Codec
import com.voxel.vpn.parser.LinkParseResult
import com.voxel.vpn.parser.ShareLinkParser
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class XrayConfigBuilderTest {
    private fun profile(link: String): ServerProfile =
        (ShareLinkParser.parse(link) as? LinkParseResult.Ok)?.profile ?: throw AssertionError("cannot parse $link")

    private fun config(link: String, options: CoreOptions = CoreOptions()): JsonObject =
        Json.parseToJsonElement(XrayConfigBuilder.build(profile(link), options)).jsonObject

    private fun JsonObject.obj(k: String) = getValue(k).jsonObject
    private fun JsonObject.arr(k: String) = getValue(k).jsonArray
    private fun JsonObject.str(k: String) = getValue(k).jsonPrimitive.content
    private fun JsonArray.objects() = map { it.jsonObject }

    @Test
    fun globalModeStructure() {
        val c = config(Samples.VLESS_REALITY)

        val tun = c.arr("inbounds").objects().single()
        assertEquals("tun", tun.str("protocol"))
        assertEquals("tun", tun.str("tag"))
        assertEquals("xray0", tun.obj("settings").str("name"))
        assertEquals(1500, tun.obj("settings").getValue("mtu").jsonPrimitive.int)
        assertTrue(tun.obj("sniffing").getValue("routeOnly").jsonPrimitive.boolean)
        assertEquals(listOf("http", "tls", "quic"), tun.obj("sniffing").arr("destOverride").map { it.jsonPrimitive.content })

        val outbounds = c.arr("outbounds").objects()
        assertEquals(listOf("proxy", "direct", "block", "dns-out"), outbounds.map { it.str("tag") })
        assertEquals(listOf("vless", "freedom", "blackhole", "dns"), outbounds.map { it.str("protocol") })
        val proxy = outbounds.first()
        assertEquals("reality", proxy.obj("streamSettings").str("security"))
        assertEquals("UseIP", proxy.obj("streamSettings").obj("sockopt").str("domainStrategy"))
        assertEquals("203.0.113.7", proxy.obj("settings").str("address"))

        val rules = c.obj("routing").arr("rules").objects()
        assertEquals(4, rules.size)
        assertEquals(listOf("dns-in"), rules[0].arr("inboundTag").map { it.jsonPrimitive.content })
        assertEquals("proxy", rules[0].str("outboundTag"))
        assertEquals("53", rules[1].str("port"))
        assertEquals("dns-out", rules[1].str("outboundTag"))
        assertEquals("direct", rules[2].str("outboundTag"))
        assertTrue(rules[2].arr("ip").map { it.jsonPrimitive.content }.containsAll(listOf("192.168.0.0/16", "10.0.0.0/8", "fc00::/7")))
        assertEquals("proxy", rules[3].str("outboundTag"))
        assertEquals("tcp,udp", rules[3].str("network"))
        assertTrue(rules.all { it.str("type") == "field" })

        val dns = c.obj("dns")
        assertEquals("dns-in", dns.str("tag"))
        assertEquals("UseIPv4", dns.str("queryStrategy"))
        assertEquals(listOf("https://1.1.1.1/dns-query", "https://8.8.8.8/dns-query"), dns.arr("servers").map { it.jsonPrimitive.content })

        val stats = c.obj("policy").obj("system")
        assertTrue(listOf("statsInboundUplink", "statsInboundDownlink", "statsOutboundUplink", "statsOutboundDownlink").all { stats.getValue(it).jsonPrimitive.boolean })
        assertNotNull(c["stats"])
        assertEquals("warning", c.obj("log").str("loglevel"))
    }

    @Test
    fun optionsAreApplied() {
        val c = config(Samples.VLESS_REALITY, CoreOptions(mtu = 1400, ipv6 = true, logLevel = "debug", sniffing = false, remoteDns = listOf("https://9.9.9.9/dns-query")))
        val tun = c.arr("inbounds").objects().single()
        assertEquals(1400, tun.obj("settings").getValue("mtu").jsonPrimitive.int)
        assertNull(tun["sniffing"])
        assertEquals("UseIP", c.obj("dns").str("queryStrategy"))
        assertEquals("debug", c.obj("log").str("loglevel"))
        assertEquals(listOf("https://9.9.9.9/dns-query"), c.obj("dns").arr("servers").map { it.jsonPrimitive.content })
    }

    @Test
    fun resolvedHostsEndUpInDnsHosts() {
        val hosts = mapOf("cdn.example.com" to listOf("198.51.100.4"), "multi.example.com" to listOf("198.51.100.5", "2001:db8::5"), "none.example.com" to emptyList())
        val c = config(Samples.VLESS_WS_TLS, CoreOptions(resolvedHosts = hosts))
        val dnsHosts = c.obj("dns").obj("hosts")
        assertEquals("198.51.100.4", dnsHosts.str("cdn.example.com"))
        assertEquals(listOf("198.51.100.5", "2001:db8::5"), dnsHosts.arr("multi.example.com").map { it.jsonPrimitive.content })
        assertFalse(dnsHosts.containsKey("none.example.com"))
    }

    @Test
    fun existingSockoptIsKeptAndExtended() {
        val outbound = Json.parseToJsonElement(
            """{"protocol":"vless","settings":{"address":"h.example.com","port":443,"id":"x","encryption":"none"},
               "streamSettings":{"network":"ws","security":"tls","sockopt":{"tcpFastOpen":true,"domainStrategy":"UseIPv4"}}}""",
        ).jsonObject
        val server = ServerProfile.fromOutbound(outbound, "x")!!
        val sockopt = XrayConfigBuilder.proxyOutbound(server).obj("streamSettings").obj("sockopt")
        assertEquals("UseIPv4", sockopt.str("domainStrategy"))
        assertTrue(sockopt.getValue("tcpFastOpen").jsonPrimitive.boolean)
        assertEquals("ws", XrayConfigBuilder.proxyOutbound(server).obj("streamSettings").str("network"))
    }

    @Test
    fun plainTcpServersGetAStreamSettingsWithOnlyTheResolverStrategy() {
        val c = config("vless://${Samples.UUID}@192.168.1.5:443#lan")
        val stream = c.arr("outbounds").objects().first().obj("streamSettings")
        assertEquals(setOf("sockopt"), stream.keys)
    }

    @Test
    fun configIsDeterministic() {
        assertEquals(XrayConfigBuilder.build(profile(Samples.VLESS_REALITY)), XrayConfigBuilder.build(profile(Samples.VLESS_REALITY)))
    }

    @Test
    fun hostsToResolve() {
        assertEquals(emptyList<String>(), XrayConfigBuilder.hostsToResolve(profile(Samples.VLESS_REALITY)))
        assertEquals(listOf("cdn.example.com"), XrayConfigBuilder.hostsToResolve(profile(Samples.VLESS_WS_TLS)))
        assertEquals(emptyList<String>(), XrayConfigBuilder.hostsToResolve(profile("vless://${Samples.UUID}@[2001:db8::7]:443?security=tls&sni=a.b")))
    }

    /**
     * Writes one generated config per protocol/transport to `voxel.configDumpDir` when that system property is set.
     * CI feeds these files to the real Xray-core (go test) to prove that the core accepts every shape we generate.
     */
    @Test
    fun dumpConfigsForTheCoreValidation() {
        val dir = System.getProperty("voxel.configDumpDir")?.takeIf { it.isNotBlank() } ?: return
        File(dir).mkdirs()
        val vmess = "vmess://" + Base64Codec.encodeStandard(
            """{"ps":"vm","add":"vm.example.com","port":"443","id":"${Samples.UUID}","net":"ws","path":"/vm","host":"vm.example.com","tls":"tls","sni":"vm.example.com"}""".toByteArray(),
        )
        val ssKey = Base64Codec.encodeStandard(ByteArray(32) { it.toByte() })
        val samples = linkedMapOf(
            "reality" to Samples.VLESS_REALITY,
            "vless-ws-tls" to Samples.VLESS_WS_TLS,
            "vless-grpc" to "vless://${Samples.UUID}@g.example.com:443?security=tls&type=grpc&serviceName=svc&mode=multi&sni=g.example.com&alpn=h2",
            "vless-xhttp" to "vless://${Samples.UUID}@x.example.com:443?security=tls&type=xhttp&path=%2Fx&host=x.example.com&mode=packet-up",
            "vless-httpupgrade" to "vless://${Samples.UUID}@h.example.com:443?security=tls&type=httpupgrade&path=%2Fhu&host=h.example.com",
            "vless-tcp-http-obfs" to "vless://${Samples.UUID}@192.168.1.9:80?type=tcp&headerType=http&host=a.example&path=%2F",
            "vless-plain-lan" to "vless://${Samples.UUID}@192.168.1.5:443#lan",
            "vless-ipv6-reality" to "vless://${Samples.UUID}@[2001:db8::7]:8443?security=reality&sni=example.com&pbk=${Samples.REALITY_PBK}&sid=ab&fp=firefox&flow=xtls-rprx-vision",
            "vmess-ws-tls" to vmess,
            "trojan" to "trojan://secret@t.example.com:443?sni=t.example.com#t",
            "ss-aead" to "ss://" + Base64Codec.encodeUrlSafe("aes-256-gcm:pw".toByteArray()) + "@203.0.113.9:8388#ss",
            "ss-2022" to "ss://2022-blake3-aes-256-gcm:$ssKey@203.0.113.10:8388#ss2022",
            "socks" to "socks5://user:pass@203.0.113.11:1080#s",
            "http" to "http://user:pass@203.0.113.12:8080#h",
        )
        val resolved = mapOf(
            "cdn.example.com" to listOf("198.51.100.4"), "g.example.com" to listOf("198.51.100.5"), "x.example.com" to listOf("198.51.100.6"),
            "h.example.com" to listOf("198.51.100.7"), "vm.example.com" to listOf("198.51.100.8"), "t.example.com" to listOf("198.51.100.9"),
        )
        samples.forEach { (name, link) ->
            File(dir, "$name.json").writeText(XrayConfigBuilder.build(profile(link), CoreOptions(resolvedHosts = resolved, ipv6 = name.contains("ipv6"))))
        }
    }
}
