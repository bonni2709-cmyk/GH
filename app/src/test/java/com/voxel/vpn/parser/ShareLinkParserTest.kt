package com.voxel.vpn.parser

import com.voxel.vpn.Samples
import com.voxel.vpn.model.ServerProfile
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ShareLinkParserTest {
    private fun parse(link: String) = ShareLinkParser.parse(link)

    private fun ok(link: String): ServerProfile {
        val r = parse(link)
        return (r as? LinkParseResult.Ok)?.profile ?: throw AssertionError("expected Ok for $link but got $r")
    }

    private fun skipped(link: String): String {
        val r = parse(link)
        return (r as? LinkParseResult.Skipped)?.reason ?: throw AssertionError("expected Skipped for $link but got $r")
    }

    private fun invalid(link: String): String {
        val r = parse(link)
        return (r as? LinkParseResult.Invalid)?.reason ?: throw AssertionError("expected Invalid for $link but got $r")
    }

    private fun JsonObject.obj(key: String) = getValue(key).jsonObject
    private fun JsonObject.str(key: String) = getValue(key).jsonPrimitive.content
    private fun ServerProfile.settings() = outbound.obj("settings")
    private fun ServerProfile.stream() = outbound.obj("streamSettings")

    // ---- VLESS -------------------------------------------------------------------------------------------

    @Test
    fun vlessReality() {
        val p = ok(Samples.VLESS_REALITY)
        assertEquals("Reality NL", p.name)
        assertEquals("vless", p.protocol)
        assertEquals("203.0.113.7", p.host)
        assertEquals(443, p.port)
        assertEquals("tcp", p.network)
        assertEquals("reality", p.security)
        assertEquals("203.0.113.7:443", p.endpoint)
        val s = p.settings()
        assertEquals(Samples.UUID, s.str("id"))
        assertEquals("xtls-rprx-vision", s.str("flow"))
        assertEquals("none", s.str("encryption"))
        val reality = p.stream().obj("realitySettings")
        assertEquals("www.microsoft.com", reality.str("serverName"))
        assertEquals("chrome", reality.str("fingerprint"))
        assertEquals(Samples.REALITY_PBK, reality.str("publicKey"))
        assertEquals("6ba85179e30d4fc2", reality.str("shortId"))
        assertEquals("/", reality.str("spiderX"))
        assertNull(p.outbound["tag"])
    }

    @Test
    fun vlessRealityNormalisesKeyAndDefaults() {
        val padded = Samples.REALITY_PBK.replace('-', '+').replace('_', '/') + "="
        val p = ok("vless://${Samples.UUID}@[2001:db8::7]:8443?security=reality&sni=example.com&pbk=$padded&spx=abc#v6")
        val reality = p.stream().obj("realitySettings")
        assertEquals(Samples.REALITY_PBK, reality.str("publicKey"))
        assertEquals("chrome", reality.str("fingerprint"))
        assertEquals("", reality.str("shortId"))
        assertEquals("/abc", reality.str("spiderX"))
        assertEquals("2001:db8::7", p.host)
        assertEquals("[2001:db8::7]:8443", p.endpoint)
    }

    @Test
    fun vlessRealityRejectsBrokenParameters() {
        val base = "vless://${Samples.UUID}@203.0.113.7:443?security=reality&sni=example.com"
        assertTrue(invalid(base).contains("public key"))
        assertTrue(invalid("$base&pbk=short").contains("32-byte"))
        assertTrue(invalid("$base&pbk=${Samples.REALITY_PBK}&sid=abc").contains("short id"))
        assertTrue(invalid("$base&pbk=${Samples.REALITY_PBK}&sid=zz").contains("short id"))
    }

    @Test
    fun vlessRealityReplacesForbiddenFingerprint() {
        val r = parse("vless://${Samples.UUID}@203.0.113.7:443?security=reality&pbk=${Samples.REALITY_PBK}&sni=a.b&fp=unsafe")
        r as LinkParseResult.Ok
        assertEquals("chrome", r.profile.stream().obj("realitySettings").str("fingerprint"))
        assertTrue(r.warnings.any { it.contains("REALITY") })
    }

    @Test
    fun vlessWebSocketTls() {
        val p = ok(Samples.VLESS_WS_TLS)
        assertEquals("WS CDN", p.name)
        assertEquals("ws", p.network)
        assertEquals("tls", p.security)
        val ws = p.stream().obj("wsSettings")
        assertEquals("/ws?ed=2048", ws.str("path"))
        assertEquals("cdn.example.com", ws.str("host"))
        val tls = p.stream().obj("tlsSettings")
        assertEquals("cdn.example.com", tls.str("serverName"))
        assertEquals("firefox", tls.str("fingerprint"))
        assertEquals(listOf("h2", "http/1.1"), tls.getValue("alpn").jsonArray.map { it.jsonPrimitive.content })
        assertNull(p.settings()["flow"])
    }

    @Test
    fun vlessGrpcAndXhttpAndHttpUpgrade() {
        val grpc = ok("vless://${Samples.UUID}@g.example.com:443?security=tls&type=grpc&serviceName=svc&mode=multi&sni=g.example.com")
        val g = grpc.stream().obj("grpcSettings")
        assertEquals("svc", g.str("serviceName"))
        assertTrue(g.getValue("multiMode").jsonPrimitive.boolean)

        val xhttp = ok(
            "vless://${Samples.UUID}@x.example.com:443?security=tls&type=xhttp&path=%2Fx&host=x.example.com&mode=packet-up" +
                "&extra=%7B%22xPaddingBytes%22%3A%22100-1000%22%7D",
        )
        assertEquals("xhttp", xhttp.network)
        val x = xhttp.stream().obj("xhttpSettings")
        assertEquals("/x", x.str("path"))
        assertEquals("packet-up", x.str("mode"))
        assertEquals("100-1000", x.obj("extra").str("xPaddingBytes"))

        val hu = ok("vless://${Samples.UUID}@h.example.com:443?security=tls&type=httpupgrade&path=%2Fhu&host=h.example.com")
        assertEquals("httpupgrade", hu.network)
        assertEquals("/hu", hu.stream().obj("httpupgradeSettings").str("path"))
    }

    @Test
    fun vlessWithoutSecurityIsOnlyAllowedOnPrivateAddresses() {
        assertTrue(skipped("vless://${Samples.UUID}@203.0.113.7:443?type=tcp&security=none").contains("without TLS"))
        assertTrue(skipped("vless://${Samples.UUID}@public.example.com:443").contains("without TLS"))
        val lan = ok("vless://${Samples.UUID}@192.168.1.5:443#lan")
        assertNull(lan.outbound["streamSettings"])
        assertEquals("tcp", lan.network)
        assertEquals("none", lan.security)
    }

    @Test
    fun vlessRemovedTransportsAndFlowsAreSkippedWithAReason() {
        val base = "vless://${Samples.UUID}@h.example.com:443?security=tls"
        assertTrue(skipped("$base&type=h2").contains("HTTP/2"))
        assertTrue(skipped("$base&type=quic").contains("QUIC"))
        assertTrue(skipped("$base&type=weird").contains("weird"))
        assertTrue(skipped("$base&flow=xtls-rprx-direct").contains("flow"))
        assertTrue(skipped("vless://${Samples.UUID}@h.example.com:443?security=other").contains("security"))
        assertTrue(skipped("$base&type=kcp&headerType=wechat-video").contains("mKCP"))
    }

    @Test
    fun vlessAllowInsecureIsDroppedWithAWarning() {
        val r = parse("vless://${Samples.UUID}@h.example.com:443?security=tls&allowInsecure=1&sni=h.example.com&pcs=AB:CD&vcn=real.example.com")
        r as LinkParseResult.Ok
        val tls = r.profile.stream().obj("tlsSettings")
        assertNull(tls["allowInsecure"])
        assertEquals("AB:CD", tls.str("pinnedPeerCertSha256"))
        assertEquals("real.example.com", tls.str("verifyPeerCertByName"))
        assertTrue(r.warnings.any { it.contains("allowInsecure") })
    }

    @Test
    fun vlessBrokenLinks() {
        invalid("vless://h.example.com:443")
        invalid("vless://@h.example.com:443")
        invalid("vless://${Samples.UUID}@:443")
        invalid("vless://${Samples.UUID}@h.example.com:0?security=tls")
    }

    @Test
    fun nameFallsBackToEndpointAndIsSanitised() {
        assertEquals("203.0.113.7:443", ok("vless://${Samples.UUID}@203.0.113.7:443?security=tls&sni=a.b").name)
        assertEquals("a b", ok("vless://${Samples.UUID}@203.0.113.7:443?security=tls&sni=a.b#a%0A%09b%00").name)
        assertEquals(100, ok("vless://${Samples.UUID}@203.0.113.7:443?security=tls&sni=a.b#" + "x".repeat(300)).name.length)
    }

    // ---- VMess -------------------------------------------------------------------------------------------

    private fun vmessJsonLink(json: String) = "vmess://" + Base64Codec.encodeStandard(json.toByteArray())

    @Test
    fun vmessV2rayNJson() {
        val link = vmessJsonLink(
            """{"v":"2","ps":"VMess WS","add":"vm.example.com","port":"443","id":"${Samples.UUID}","aid":"0","scy":"auto",
               "net":"ws","type":"none","host":"vm.example.com","path":"/vm","tls":"tls","sni":"vm.example.com","alpn":"","fp":"chrome"}""",
        )
        val p = ok(link)
        assertEquals("VMess WS", p.name)
        assertEquals("vmess", p.protocol)
        assertEquals(443, p.port)
        assertEquals("ws", p.network)
        assertEquals("tls", p.security)
        assertEquals(Samples.UUID, p.settings().str("id"))
        assertEquals("auto", p.settings().str("security"))
        assertEquals("/vm", p.stream().obj("wsSettings").str("path"))
    }

    @Test
    fun vmessNumericPortGrpcAndTcpWithoutSecurity() {
        val grpc = ok(
            vmessJsonLink("""{"ps":"g","add":"g.example.com","port":8443,"id":"${Samples.UUID}","scy":"aes-128-gcm","net":"grpc","path":"svc","type":"multi","tls":"tls"}"""),
        )
        assertEquals(8443, grpc.port)
        assertEquals("aes-128-gcm", grpc.settings().str("security"))
        val g = grpc.stream().obj("grpcSettings")
        assertEquals("svc", g.str("serviceName"))
        assertTrue(g.getValue("multiMode").jsonPrimitive.boolean)

        val tcp = ok(vmessJsonLink("""{"ps":"t","add":"203.0.113.9","port":"80","id":"${Samples.UUID}","net":"tcp","tls":""}"""))
        assertNull(tcp.outbound["streamSettings"])
        assertEquals("auto", tcp.settings().str("security"))
    }

    @Test
    fun vmessUriStyleAndBrokenPayloads() {
        val p = ok("vmess://${Samples.UUID}@vm.example.com:443?type=ws&security=tls&path=%2Fvm&host=vm.example.com&sni=vm.example.com#Uri")
        assertEquals("Uri", p.name)
        assertEquals("ws", p.network)
        invalid("vmess://%%%")
        invalid(vmessJsonLink("not json"))
        invalid(vmessJsonLink("""{"ps":"x","add":"h","port":"abc","id":"i"}"""))
        invalid(vmessJsonLink("""{"ps":"x","port":"1","id":"i"}"""))
        skipped(vmessJsonLink("""{"ps":"x","add":"h.example.com","port":"443","id":"i","net":"h2","tls":"tls"}"""))
    }

    // ---- Trojan ------------------------------------------------------------------------------------------

    @Test
    fun trojanDefaultsToTls() {
        val p = ok("trojan://p%40ss%3Aword@t.example.com:443?sni=t.example.com&type=tcp#Troj")
        assertEquals("trojan", p.protocol)
        assertEquals("p@ss:word", p.settings().str("password"))
        assertEquals("tls", p.security)
        assertEquals("t.example.com", p.stream().obj("tlsSettings").str("serverName"))
        assertEquals("Troj", p.name)
    }

    @Test
    fun trojanWithoutTlsOnPublicHostIsSkipped() {
        assertTrue(skipped("trojan://pw@t.example.com:443?security=none").contains("without TLS"))
        invalid("trojan://@t.example.com:443")
    }

    // ---- Shadowsocks -------------------------------------------------------------------------------------

    @Test
    fun shadowsocksSip002() {
        val creds = Base64Codec.encodeUrlSafe("aes-256-gcm:s3cr:et".toByteArray())
        val p = ok("ss://$creds@1.2.3.4:8388#SS%20Node")
        assertEquals("shadowsocks", p.protocol)
        assertEquals("SS Node", p.name)
        assertEquals("1.2.3.4", p.host)
        assertEquals(8388, p.port)
        assertEquals("aes-256-gcm", p.settings().str("method"))
        assertEquals("s3cr:et", p.settings().str("password"))
        assertNull(p.outbound["streamSettings"])
    }

    @Test
    fun shadowsocksLegacyWholeLinkBase64() {
        val body = Base64Codec.encodeStandard("chacha20-ietf-poly1305:pw@5.6.7.8:443".toByteArray())
        val p = ok("ss://$body#Legacy")
        assertEquals("chacha20-poly1305", p.settings().str("method"))
        assertEquals("pw", p.settings().str("password"))
        assertEquals("5.6.7.8", p.host)
        assertEquals("Legacy", p.name)
    }

    @Test
    fun shadowsocks2022PlainUserInfoAndPasswordWithSlash() {
        val key = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8="
        val p = ok("ss://2022-blake3-aes-256-gcm:$key@host.example.com:8388#v2022")
        assertEquals("2022-blake3-aes-256-gcm", p.settings().str("method"))
        assertEquals(key, p.settings().str("password"))
        val slashy = ok("ss://aes-128-gcm:ab/cd+ef@host.example.com:8388")
        assertEquals("ab/cd+ef", slashy.settings().str("password"))
    }

    @Test
    fun shadowsocksPluginsAndUnknownCiphersAreSkipped() {
        val creds = Base64Codec.encodeUrlSafe("aes-256-gcm:pw".toByteArray())
        assertTrue(skipped("ss://$creds@1.2.3.4:8388/?plugin=v2ray-plugin%3Bhost%3Dx").contains("plugin"))
        val rc4 = Base64Codec.encodeUrlSafe("rc4-md5:pw".toByteArray())
        assertTrue(skipped("ss://$rc4@1.2.3.4:8388").contains("cipher"))
        invalid("ss://!!!")
        invalid("ss://")
    }

    // ---- SOCKS / HTTP ------------------------------------------------------------------------------------

    @Test
    fun socksWithPlainAndBase64Credentials() {
        val plain = ok("socks5://user:p%40ss@10.0.0.1:1080#S5")
        assertEquals("socks", plain.protocol)
        assertEquals("user", plain.settings().str("user"))
        assertEquals("p@ss", plain.settings().str("pass"))
        val b64 = ok("socks://" + Base64Codec.encodeUrlSafe("bob:secret".toByteArray()) + "@10.0.0.2:1081")
        assertEquals("bob", b64.settings().str("user"))
        assertEquals("secret", b64.settings().str("pass"))
        val anon = ok("socks5://10.0.0.3:1080")
        assertNull(anon.settings()["user"])
        invalid("socks5://10.0.0.3")
    }

    @Test
    fun httpProxyNeedsCredentials() {
        val p = ok("http://u:p@proxy.example.com:8080#H")
        assertEquals("http", p.protocol)
        assertEquals("u", p.settings().str("user"))
        assertEquals(8080, p.port)
        assertEquals("tcp", p.network)
        val tls = ok("https://u:p@proxy.example.com#HS")
        assertEquals(443, tls.port)
        assertEquals("tls", tls.security)
        assertEquals(LinkParseResult.NotALink, parse("https://sub.example.com/path?token=abc"))
        assertEquals(LinkParseResult.NotALink, parse("http://sub.example.com/sub"))
    }

    // ---- unsupported / unrelated -------------------------------------------------------------------------

    @Test
    fun recognisedButUnsupportedSchemesAreSkipped() {
        assertTrue(skipped("ssr://abc").contains("ShadowsocksR"))
        assertTrue(skipped("tuic://u:p@h:443").contains("TUIC"))
        assertTrue(skipped("hysteria://h:443?auth=x").contains("Hysteria"))
        assertTrue(skipped("hy2://x@h:443").contains("Hysteria2"))
        assertTrue(skipped("hysteria2://x@h:443").contains("Hysteria2"))
        assertTrue(skipped("wireguard://key@h:51820").contains("WireGuard"))
        assertTrue(skipped("awg://key@h:51820").contains("AmneziaWG"))
        assertTrue(skipped("socks4://h:1080").contains("SOCKS4"))
    }

    @Test
    fun nonLinksAreNotLinks() {
        assertEquals(LinkParseResult.NotALink, parse("hello world"))
        assertEquals(LinkParseResult.NotALink, parse("ftp://example.com/file"))
        assertEquals(LinkParseResult.NotALink, parse(""))
        assertEquals("vless", ShareLinkParser.schemeOf("  VLESS://x"))
        assertNull(ShareLinkParser.schemeOf("no scheme"))
    }

    @Test
    fun isProxyLinkClassification() {
        assertTrue(ShareLinkParser.isProxyLink("vless://x@h:1"))
        assertTrue(ShareLinkParser.isProxyLink("ssr://x"))
        assertTrue(ShareLinkParser.isProxyLink("http://u:p@h:8080"))
        assertFalse(ShareLinkParser.isProxyLink("https://sub.example.com/a"))
        assertFalse(ShareLinkParser.isProxyLink("plain text"))
    }

    @Test
    fun tolerantOfSurroundingNoise() {
        val p = ok("\uFEFF  ${Samples.VLESS_REALITY}\r\n")
        assertEquals("Reality NL", p.name)
        assertTrue(p.id.length == 16)
    }

    @Test
    fun profileIdIsStableAndIgnoresName() {
        val a = ok(Samples.VLESS_REALITY)
        val b = ok(Samples.VLESS_REALITY.replace("#Reality%20NL", "#Other"))
        assertEquals(a.id, b.id)
        assertFalse(a.id == ok(Samples.VLESS_WS_TLS).id)
        val attached = a.attachTo("sub1")
        assertEquals("sub1", attached.subscriptionId)
        assertFalse(attached.id == a.id)
        assertEquals(attached.id, a.attachTo("sub1").id)
        assertFalse(attached.id == a.attachTo("sub2").id)
    }

    @Test
    fun outboundArraysAreJsonArrays() {
        val p = ok(Samples.VLESS_WS_TLS)
        assertTrue(p.stream().obj("tlsSettings").getValue("alpn") is JsonArray)
    }
}
