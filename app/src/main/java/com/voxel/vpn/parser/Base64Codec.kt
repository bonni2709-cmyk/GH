package com.voxel.vpn.parser

import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction

/**
 * Tolerant Base64. Subscriptions and share links in the wild mix the standard and the URL-safe
 * alphabets, with and without padding, often wrapped across lines, so decoding accepts all of it.
 * Implemented by hand: `java.util.Base64` needs API 26 and `android.util.Base64` is not available
 * in plain JVM unit tests.
 */
object Base64Codec {
    private const val STD_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    private const val URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

    private val DECODE = IntArray(128) { -1 }.also { table ->
        STD_ALPHABET.forEachIndexed { i, c -> table[c.code] = i }
        table['-'.code] = 62
        table['_'.code] = 63
    }

    /** Decodes [input]; returns null when it is not valid Base64 in any of the accepted flavours. */
    fun decode(input: String): ByteArray? {
        val sb = StringBuilder(input.length)
        for (ch in input) {
            if (ch.isWhitespace()) continue
            sb.append(ch)
        }
        var end = sb.length
        while (end > 0 && sb[end - 1] == '=') end--
        if (end == 0) return null
        if (end % 4 == 1) return null

        val out = ByteArray(end * 6 / 8)
        var o = 0
        var buffer = 0
        var bits = 0
        for (i in 0 until end) {
            val c = sb[i]
            val v = if (c.code < 128) DECODE[c.code] else -1
            if (v < 0) return null
            buffer = (buffer shl 6) or v
            bits += 6
            if (bits >= 8) {
                bits -= 8
                out[o++] = ((buffer shr bits) and 0xFF).toByte()
                buffer = buffer and ((1 shl bits) - 1)
            }
        }
        return if (o == out.size) out else out.copyOf(o)
    }

    /** Decodes [input] and interprets the bytes as strict UTF-8; null if either step fails. */
    fun decodeToString(input: String): String? {
        val bytes = decode(input) ?: return null
        return utf8OrNull(bytes)
    }

    fun encodeUrlSafe(bytes: ByteArray): String = encode(bytes, URL_ALPHABET, pad = false)

    fun encodeStandard(bytes: ByteArray): String = encode(bytes, STD_ALPHABET, pad = true)

    /** Cheap pre-check: only Base64 characters (either alphabet), padding and whitespace. */
    fun looksLikeBase64(input: String): Boolean {
        var significant = 0
        for (ch in input) {
            if (ch.isWhitespace()) continue
            if (ch == '=') continue
            val ok = ch.code < 128 && DECODE[ch.code] >= 0
            if (!ok) return false
            significant++
        }
        return significant >= 4
    }

    internal fun utf8OrNull(bytes: ByteArray): String? = try {
        Charsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
            .decode(ByteBuffer.wrap(bytes))
            .toString()
    } catch (_: java.nio.charset.CharacterCodingException) {
        null
    }

    private fun encode(bytes: ByteArray, alphabet: String, pad: Boolean): String {
        val sb = StringBuilder((bytes.size + 2) / 3 * 4)
        var i = 0
        while (i + 2 < bytes.size) {
            val n = ((bytes[i].toInt() and 0xFF) shl 16) or ((bytes[i + 1].toInt() and 0xFF) shl 8) or (bytes[i + 2].toInt() and 0xFF)
            sb.append(alphabet[(n shr 18) and 63]).append(alphabet[(n shr 12) and 63])
                .append(alphabet[(n shr 6) and 63]).append(alphabet[n and 63])
            i += 3
        }
        when (bytes.size - i) {
            1 -> {
                val n = (bytes[i].toInt() and 0xFF) shl 16
                sb.append(alphabet[(n shr 18) and 63]).append(alphabet[(n shr 12) and 63])
                if (pad) sb.append("==")
            }
            2 -> {
                val n = ((bytes[i].toInt() and 0xFF) shl 16) or ((bytes[i + 1].toInt() and 0xFF) shl 8)
                sb.append(alphabet[(n shr 18) and 63]).append(alphabet[(n shr 12) and 63]).append(alphabet[(n shr 6) and 63])
                if (pad) sb.append('=')
            }
        }
        return sb.toString()
    }
}
