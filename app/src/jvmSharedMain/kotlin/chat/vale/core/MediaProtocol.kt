package chat.vale.core

import kotlinx.serialization.encodeToString

/** Data is inside the signed/encrypted packet, never in the routing header. */
internal fun encodeContent(content: Content): String = CONTENT_PREFIX + json.encodeToString(content)

internal fun decodeContent(value: String): Content? = try {
    if (!value.startsWith(CONTENT_PREFIX)) {
        if (value.toByteArray(Charsets.UTF_8).size > 16_384) null else Content(kind = "text", text = value)
    } else json.decodeFromString<Content>(value.removePrefix(CONTENT_PREFIX)).takeIf(::validContent)
} catch (_: Exception) { null }

internal fun validContent(c: Content): Boolean = try {
    when (c.kind) {
        "text" -> c.text.isNotBlank() && c.text.toByteArray(Charsets.UTF_8).size <= 16_384
        "sticker-emoji" -> c.text.isNotBlank() && c.text.length <= 16 && c.media.isEmpty()
        "sticker", "audio", "video" -> {
            if (c.media.length > (MAX_MEDIA_BYTES * 4 / 3 + 8) || c.media.isEmpty()) false
            else {
                val bytes = c.media.unb64()
                val mime = c.mime.lowercase()
                val ebml = bytes.size >= 4 && bytes[0] == 0x1a.toByte() && bytes[1] == 0x45.toByte() && bytes[2] == 0xdf.toByte() && bytes[3] == 0xa3.toByte()
                val mp4 = bytes.size >= 12 && String(bytes, 4, 4, Charsets.US_ASCII) == "ftyp"
                val png = bytes.size >= 8 && bytes.copyOfRange(0, 8).contentEquals(byteArrayOf(-119, 80, 78, 71, 13, 10, 26, 10))
                val webp = bytes.size >= 12 && String(bytes, 0, 4, Charsets.US_ASCII) == "RIFF" && String(bytes, 8, 4, Charsets.US_ASCII) == "WEBP"
                val jpeg = bytes.size >= 3 && bytes[0] == 0xff.toByte() && bytes[1] == 0xd8.toByte() && bytes[2] == 0xff.toByte()
                bytes.size in 1..MAX_MEDIA_BYTES && c.media == bytes.b64() && c.durationMs in 0..60_000 && when (c.kind) {
                    "audio" -> mime.startsWith("audio/webm") && "opus" in mime && ebml
                    "video" -> ((mime.startsWith("video/mp4") && "avc1" in mime && mp4) ||
                        (mime.startsWith("video/webm") && ("h264" in mime || "avc1" in mime) && ebml))
                    else -> (mime == "image/png" && png) || (mime == "image/webp" && webp) || (mime == "image/jpeg" && jpeg)
                }
            }
        }
        "call-offer", "call-answer" -> c.callId.matches(Regex("[A-Za-z0-9_-]{22}")) && c.sdp.length in 1..32_000 && c.sdp.startsWith("v=0")
        "call-end" -> c.callId.matches(Regex("[A-Za-z0-9_-]{22}")) && c.sdp.isEmpty()
        else -> false
    }
} catch (_: Exception) { false }

internal fun mediaLabel(kind: String): String = when (kind) {
    "audio" -> "Голосовое сообщение"
    "video" -> "Видеокружок"
    "sticker", "sticker-emoji" -> "Стикер"
    else -> "Сообщение"
}
