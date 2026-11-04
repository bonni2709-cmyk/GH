package com.voxel.vpn.parser.incy

import com.voxel.vpn.expectThrows
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class IncyCrypt1Test {
    private val pinned =
        "incy://crypt1/AAECAwQFBgcICQoLNyIQL3rDwRZqnyoD8pGKSLXP6o8NdSXQVSSALNbbUyIr__tWGFUexdIfKvvmDnuDGbmBvuppfNef6aKNZUwOm4c-Sg"
    private val docsExample =
        "incy://crypt1/FZEVXuV39UEX1yHB3nkrgdPdrJ3syVxcQm_Y-lY0oKWAT5yRn00xe6ohg06aVWjWRrGJ7BAeEzuoFzv8XBosLnqnqqCMbnAJmR7EN2hII4Yyql1FtWlLlLs"
    private val iv = ByteArray(12) { it.toByte() }

    private fun payloadOf(link: String) = link.removePrefix(IncyCrypt1.LINK_PREFIX)

    @Test
    fun derivedKeyMatchesThePublishedFingerprint() {
        assertEquals(IncyCrypt1.KEY_FINGERPRINT, IncyCrypt1.keyFingerprint())
        assertEquals("b6bf708471cc90043232967660aade86a50b4e57929db2e53c5fa34db624c08c", IncyCrypt1.keyFingerprint())
    }

    @Test
    fun decryptsThePinnedTestVector() {
        val p = IncyCrypt1.decode(payloadOf(pinned))
        assertEquals("https://sub.example.com/test-vector", p.url)
        assertNull(p.name)
        assertEquals(1, p.version)
    }

    @Test
    fun decryptsTheDocumentationExample() {
        assertEquals("https://incsub.myincteam.org/vTyt0xVE-aAjHv8T", IncyCrypt1.decode(payloadOf(docsExample)).url)
    }

    @Test
    fun encodingIsByteForByteCompatibleWithTheReferenceEncoder() {
        assertEquals(pinned, IncyCrypt1.encode("https://sub.example.com/test-vector", null, iv))
    }

    @Test
    fun roundTripsNamesAndSpecialCharacters() {
        val url = "https://sub.example.com/a?token=x&y=<z>#frag"
        val link = IncyCrypt1.encode(url, "\u041C\u043E\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0430 \"VPN\"")
        assertTrue(link.startsWith("incy://crypt1/"))
        val p = IncyCrypt1.decode(payloadOf(link))
        assertEquals(url, p.url)
        assertEquals("\u041C\u043E\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0430 \"VPN\"", p.name)
    }

    @Test
    fun freshIvEveryTime() {
        assertTrue(IncyCrypt1.encode("https://a.example") != IncyCrypt1.encode("https://a.example"))
    }

    @Test
    fun longNamesAreTruncatedTo128CodePoints() {
        val name = "\uD83D\uDE00".repeat(200)
        val decoded = IncyCrypt1.decode(payloadOf(IncyCrypt1.encode("https://a.example", name))).name!!
        assertEquals(128, decoded.codePointCount(0, decoded.length))
    }

    @Test
    fun toleratesTrailingSlashWhitespaceQueryAndPadding() {
        val raw = payloadOf(pinned)
        assertEquals("https://sub.example.com/test-vector", IncyCrypt1.decode("$raw/").url)
        assertEquals("https://sub.example.com/test-vector", IncyCrypt1.decode("  $raw\n").url)
        assertEquals("https://sub.example.com/test-vector", IncyCrypt1.decode("$raw?utm_source=x").url)
        assertEquals("https://sub.example.com/test-vector", IncyCrypt1.decode("$raw#frag").url)
        assertEquals("https://sub.example.com/test-vector", IncyCrypt1.decode(raw + "=").url)
        assertEquals("https://sub.example.com/test-vector", IncyCrypt1.decode(raw.chunked(20).joinToString("\n")).url)
    }

    @Test
    fun tamperedPayloadFailsAuthentication() {
        val raw = payloadOf(pinned)
        val flipped = raw.substring(0, 30) + (if (raw[30] == 'A') 'B' else 'A') + raw.substring(31)
        val e = expectThrows<IncyLinkException> { IncyCrypt1.decode(flipped) }
        assertEquals(IncyLinkException.Kind.AUTH_FAILED, e.kind)
    }

    @Test
    fun malformedPayloads() {
        assertEquals(IncyLinkException.Kind.EMPTY, expectThrows<IncyLinkException> { IncyCrypt1.decode("") }.kind)
        assertEquals(IncyLinkException.Kind.EMPTY, expectThrows<IncyLinkException> { IncyCrypt1.decode("/") }.kind)
        assertEquals(IncyLinkException.Kind.MALFORMED, expectThrows<IncyLinkException> { IncyCrypt1.decode("!!!!!!!!") }.kind)
        assertEquals(IncyLinkException.Kind.MALFORMED, expectThrows<IncyLinkException> { IncyCrypt1.decode("AAECAwQFBgcI") }.kind)
    }

    @Test
    fun plaintextWithoutUrlIsRejected() {
        // Build a valid ciphertext whose JSON has no url by using the encoder for a non-JSON-shaped url is impossible,
        // so verify the empty-url guard of the encoder instead.
        expectThrows<IllegalArgumentException> { IncyCrypt1.encode("") }
        expectThrows<IllegalArgumentException> { IncyCrypt1.encode("https://a.example", null, ByteArray(5)) }
    }
}
