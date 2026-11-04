package com.voxel.vpn.parser

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class LinkUriTest {
    @Test
    fun splitsAllParts() {
        val u = LinkUri.parse("vless://abc-123@example.com:8443/some/path?type=ws&host=a.b#My%20Name")!!
        assertEquals("vless", u.scheme)
        assertEquals("abc-123", u.userInfo)
        assertEquals("example.com", u.host)
        assertEquals(8443, u.port)
        assertEquals("/some/path", u.path)
        assertEquals("ws", u.queryParams["type"])
        assertEquals("a.b", u.queryParams["host"])
        assertEquals("My Name", u.fragment)
    }

    @Test
    fun handlesIpv6Hosts() {
        val u = LinkUri.parse("trojan://pw@[2001:db8::1]:8443?sni=x#v6")!!
        assertEquals("2001:db8::1", u.host)
        assertEquals(8443, u.port)
        val noPort = LinkUri.parse("trojan://pw@[2001:db8::1]")!!
        assertEquals("2001:db8::1", noPort.host)
        assertNull(noPort.port)
    }

    @Test
    fun keepsEmojiAndUnicodeInFragment() {
        val u = LinkUri.parse("vless://u@h.example:443#\uD83C\uDDE9\uD83C\uDDEA Berlin %E2%9C%88")!!
        assertEquals("\uD83C\uDDE9\uD83C\uDDEA Berlin \u2708", u.fragment)
    }

    @Test
    fun base64UserInfoMayContainSlash() {
        val u = LinkUri.parse("ss://YWVz/Zg+x==@host.example:8388/?x=1#n")!!
        assertEquals("YWVz/Zg+x==", u.userInfo)
        assertEquals("host.example", u.host)
        assertEquals(8388, u.port)
        assertEquals("1", u.queryParams["x"])
    }

    @Test
    fun atSignInQueryIsNotUserInfo() {
        val u = LinkUri.parse("https://sub.example.com/path?email=a@b.com&t=1")!!
        assertNull(u.userInfo)
        assertEquals("sub.example.com", u.host)
        assertEquals("a@b.com", u.queryParams["email"])
    }

    @Test
    fun decodesQueryValues() {
        val u = LinkUri.parse("vless://u@h:1?alpn=h2%2Chttp%2F1.1&path=%2Fa+b&flag&dup=1&dup=2")!!
        assertEquals("h2,http/1.1", u.queryParams["alpn"])
        assertEquals("/a+b", u.queryParams["path"])
        assertEquals("", u.queryParams["flag"])
        assertEquals("1", u.queryParams["dup"])
    }

    @Test
    fun percentDecodeToleratesMalformedEscapes() {
        assertEquals("100%", LinkUri.percentDecode("100%"))
        assertEquals("%zz", LinkUri.percentDecode("%zz"))
        assertEquals("\u20AC", LinkUri.percentDecode("%E2%82%AC"))
        assertEquals("a b", LinkUri.percentDecode("a%20b"))
    }

    @Test
    fun rejectsBrokenInput() {
        assertNull(LinkUri.parse("not a url"))
        assertNull(LinkUri.parse("://nohost"))
        assertNull(LinkUri.parse("vless://u@h:notaport"))
        assertNull(LinkUri.parse("vless://u@h:70000"))
        assertNull(LinkUri.parse("vless://u@[::1"))
        assertNotNull(LinkUri.parse("vless://u@h"))
    }
}
