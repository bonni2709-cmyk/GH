package chat.vale.core

import java.net.HttpURLConnection
import java.net.Socket
import java.net.URI
import java.util.Base64
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class MediaProtocolTest {
    private val png = Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aWQAAAAASUVORK5CYII=")

    @Test fun contentLimitsAndAuthenticatedMediaBody() {
        val sticker = Content("sticker", media = png.b64(), mime = "image/png")
        assertTrue(validContent(sticker))
        assertEquals(sticker, decodeContent(encodeContent(sticker)))
        assertContentEquals(png, assertNotNull(decodeContent(encodeContent(sticker))).media.unb64())
        assertFalse(validContent(sticker.copy(mime = "image/svg+xml")))
        assertFalse(validContent(Content("text", text = "hello", media = png.b64())))
        assertFalse(validContent(sticker.copy(sdp = "unexpected")))
        val ebml = byteArrayOf(0x1a, 0x45, 0xdf.toByte(), 0xa3.toByte(), 0, 0, 0, 0)
        val audio = Content("audio", media = ebml.b64(), mime = "audio/webm;codecs=opus", durationMs = 1_000)
        assertTrue(validContent(audio))
        assertFalse(validContent(audio.copy(mime = "audio/webm;codecs=vorbis")))
        val mp4 = byteArrayOf(0, 0, 0, 12, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0)
        val video = Content("video", media = mp4.b64(), mime = "video/mp4;codecs=avc1.42E01E,mp4a.40.2", durationMs = 1_000)
        assertTrue(validContent(video))
        assertFalse(validContent(video.copy(mime = "video/mp4;codecs=vp9")))
        assertFalse(validContent(sticker.copy(media = ByteArray(MAX_MEDIA_BYTES + 1).b64())))
        assertEquals("hello", decodeContent("hello")?.text)
        assertEquals(null, decodeContent(CONTENT_PREFIX + "{bad json}"))
    }

    @Test fun loopbackBridgeRequiresTokenAndRejectsDnsRebinding() {
        val server = MediaServer(BrowserConfig("studio", "Alice")) { it.action == "hello" }
        try {
            val uri = URI(server.url)
            val base = "http://${uri.host}:${uri.port}"
            fun request(path: String, token: String? = null): Pair<Int, String> {
                val connection = URI(base + path).toURL().openConnection() as HttpURLConnection
                if (token != null) connection.setRequestProperty("X-Vale-Token", token)
                val code = connection.responseCode
                val text = (if (code == 200) connection.inputStream else connection.errorStream).bufferedReader().readText()
                connection.disconnect()
                return code to text
            }
            assertEquals(200, request("/").first)
            assertEquals(403, request("/config").first)
            assertEquals(403, request("/config", "not-the-secret").first)
            assertTrue(request("/config", uri.fragment).second.contains("Alice"))
            Socket(uri.host, uri.port).use { socket ->
                socket.getOutputStream().write("GET /config HTTP/1.1\r\nHost: attacker.example\r\nX-Vale-Token: ${uri.fragment}\r\n\r\n".toByteArray())
                assertTrue(socket.getInputStream().bufferedReader().readLine().contains("403"))
            }
        } finally { server.close() }
    }
}
