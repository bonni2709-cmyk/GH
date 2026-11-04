package com.voxel.vpn.parser

import com.voxel.vpn.Samples
import com.voxel.vpn.expectThrows
import com.voxel.vpn.parser.incy.ControlAction
import com.voxel.vpn.parser.incy.IncyCommand
import com.voxel.vpn.parser.incy.IncyCrypt1
import com.voxel.vpn.parser.incy.IncyLinkException
import com.voxel.vpn.parser.incy.IncyLinkParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class IncyLinkParserTest {
    private val subUrl = "https://sub.example.com/a?token=1"

    private fun subscriptions(input: String) =
        IncyLinkParser.parse(input) as? IncyCommand.Subscriptions ?: throw AssertionError("expected Subscriptions for $input")

    private fun inline(input: String) =
        IncyLinkParser.parse(input) as? IncyCommand.Inline ?: throw AssertionError("expected Inline for $input")

    private fun kind(input: String) = expectThrows<IncyLinkException> { IncyLinkParser.parse(input) }.kind

    @Test
    fun controlActions() {
        assertEquals(IncyCommand.Control(ControlAction.CONNECT), IncyLinkParser.parse("incy://connect"))
        assertEquals(IncyCommand.Control(ControlAction.TOGGLE), IncyLinkParser.parse("INCY://Toggle/"))
        assertEquals(IncyCommand.Control(ControlAction.DISCONNECT), IncyLinkParser.parse("incy://disconnect"))
        assertEquals(IncyCommand.Control(ControlAction.STATUS), IncyLinkParser.parse("  incy://status  "))
        ControlAction.entries.forEach { assertEquals(IncyCommand.Control(it), IncyLinkParser.parse("incy://${it.name.lowercase()}")) }
    }

    @Test
    fun crypt1PinnedVector() {
        val pinned =
            "incy://crypt1/AAECAwQFBgcICQoLNyIQL3rDwRZqnyoD8pGKSLXP6o8NdSXQVSSALNbbUyIr__tWGFUexdIfKvvmDnuDGbmBvuppfNef6aKNZUwOm4c-Sg"
        val c = subscriptions(pinned)
        assertEquals(listOf("https://sub.example.com/test-vector"), c.urls)
        assertNull(c.nameHint)
        assertEquals("incy:crypt1", c.origin)
    }

    @Test
    fun crypt1CarriesTheNameHintAndUrlFragmentLosesToIt() {
        val c = subscriptions(IncyCrypt1.encode("$subUrl#FromUrl", "My VPN"))
        assertEquals(listOf(subUrl), c.urls)
        assertEquals("My VPN", c.nameHint)
        val fromFragment = subscriptions(IncyCrypt1.encode("$subUrl#FromUrl"))
        assertEquals("FromUrl", fromFragment.nameHint)
    }

    @Test
    fun crypt1Errors() {
        assertEquals(IncyLinkException.Kind.UNSUPPORTED_VERSION, kind("incy://crypt2/AAAA"))
        assertEquals(IncyLinkException.Kind.UNSUPPORTED_VERSION, kind("incy://crypt10/AAAA"))
        assertEquals(IncyLinkException.Kind.EMPTY, kind("incy://crypt1/"))
        assertEquals(IncyLinkException.Kind.MALFORMED, kind("incy://crypt1/%%%"))
        val good = IncyCrypt1.encode(subUrl)
        val tampered = good.substring(0, good.length - 8) + "AAAAAAAA"
        assertEquals(IncyLinkException.Kind.AUTH_FAILED, kind(tampered))
    }

    @Test
    fun addWithRawEncodedAndQueryUrls() {
        val raw = subscriptions("incy://add/$subUrl#Nice%20Name")
        assertEquals(listOf(subUrl), raw.urls)
        assertEquals("Nice Name", raw.nameHint)
        assertEquals("incy:add", raw.origin)

        val encoded = subscriptions("incy://add/https%3A%2F%2Fsub.example.com%2Fa%3Ftoken%3D1")
        assertEquals(listOf(subUrl), encoded.urls)

        val query = subscriptions("incy://add?url=https%3A%2F%2Fsub.example.com%2Fa%3Ftoken%3D1")
        assertEquals(listOf(subUrl), query.urls)

        assertEquals(IncyLinkException.Kind.EMPTY, kind("incy://add/"))
        assertEquals(IncyLinkException.Kind.MALFORMED, kind("incy://add?foo=1"))
        assertEquals(IncyLinkException.Kind.MALFORMED, kind("incy://add/vless://${Samples.UUID}@h:1"))
    }

    @Test
    fun importAutoDetectsTheKindOfData() {
        // subscription URL, Base64 of a URL
        assertEquals(listOf(subUrl), subscriptions("incy://import/$subUrl").urls)
        assertEquals(
            listOf("https://sub.example.com/a"),
            subscriptions("incy://import/" + Base64Codec.encodeUrlSafe("https://sub.example.com/a".toByteArray())).urls,
        )
        // share link, percent-encoded share link
        assertEquals(Samples.VLESS_REALITY, inline("incy://import/${Samples.VLESS_REALITY}").text)
        val encoded = java.net.URLEncoder.encode("vless://${Samples.UUID}@h.example.com:443?security=tls#n", "UTF-8")
        assertTrue(inline("incy://import/$encoded").text.startsWith("vless://"))
        // Base64 of a list of links (decoded once, imported inline)
        val list = Samples.VLESS_REALITY + "\n" + Samples.VLESS_WS_TLS
        val c = inline("incy://import/" + Base64Codec.encodeStandard(list.toByteArray()))
        assertEquals(list, c.text)
        assertEquals("incy:import", c.origin)
        // HTTP proxy with credentials is a server, not a subscription
        assertEquals("http://u:p@proxy.example.com:8080", inline("incy://import/http://u:p@proxy.example.com:8080").text)
        // multiple URLs
        val multi = subscriptions("incy://import/" + java.net.URLEncoder.encode("https://a.example/s\nhttps://b.example/s", "UTF-8"))
        assertEquals(listOf("https://a.example/s", "https://b.example/s"), multi.urls)
        // raw WireGuard config
        val wg = inline("incy://import/" + Base64Codec.encodeStandard("[Interface]\nPrivateKey = x\n".toByteArray()))
        assertTrue(wg.text.startsWith("[Interface]"))
    }

    @Test
    fun routingAndUnknownActions() {
        assertEquals(IncyLinkException.Kind.UNSUPPORTED, kind("incy://routing/onadd/abc"))
        assertEquals(IncyLinkException.Kind.UNSUPPORTED, kind("incy://autorouting/add/https://x.example/r"))
        assertEquals(IncyLinkException.Kind.UNSUPPORTED, kind("incy://onadd/https://x.example/r"))
        assertEquals(IncyLinkException.Kind.MALFORMED, kind("incy://frobnicate"))
        assertEquals(IncyLinkException.Kind.EMPTY, kind("incy://"))
        assertEquals(IncyLinkException.Kind.EMPTY, kind("   "))
    }

    @Test
    fun plainPastedText() {
        assertEquals(listOf(subUrl), subscriptions(subUrl).urls)
        assertEquals("paste", subscriptions(subUrl).origin)
        assertEquals("Fragment", subscriptions("$subUrl#Fragment").nameHint)
        val two = subscriptions("https://a.example/s \n https://b.example/s#x")
        assertEquals(listOf("https://a.example/s", "https://b.example/s"), two.urls)
        assertNull(two.nameHint)
        assertEquals(listOf("https://a.example/s"), subscriptions("https://a.example/s\nhttps://a.example/s").urls)

        assertEquals(Samples.VLESS_REALITY, inline(Samples.VLESS_REALITY).text)
        assertTrue(inline("[{\"outbounds\":[]}]").text.startsWith("["))
        assertTrue(inline("{\"outbounds\":[]}").text.startsWith("{"))
        assertTrue(inline("#profile-title: X\nvless://a@b:1").text.contains("profile-title"))
    }

    @Test
    fun mixedUrlsAndLinksAreImportedInline() {
        val text = "https://a.example/s\n${Samples.VLESS_REALITY}"
        assertTrue(IncyLinkParser.parse(text) is IncyCommand.Inline)
    }

    @Test
    fun nestingIsBounded() {
        var link = "incy://import/" + Base64Codec.encodeUrlSafe(subUrl.toByteArray())
        repeat(12) { link = "incy://import/" + Base64Codec.encodeUrlSafe(link.toByteArray()) }
        // Past the nesting limit nothing is unwrapped any further: the text is handed on as opaque inline data.
        val outcome = runCatching { IncyLinkParser.parse(link) }
        assertTrue(outcome.exceptionOrNull() is IncyLinkException || outcome.getOrNull() is IncyCommand.Inline)
    }

    @Test
    fun isIncyLink() {
        assertTrue(IncyLinkParser.isIncyLink(" incy://connect"))
        assertTrue(IncyLinkParser.isIncyLink("INCY://x"))
        assertFalse(IncyLinkParser.isIncyLink("happ://add/x"))
    }
}
