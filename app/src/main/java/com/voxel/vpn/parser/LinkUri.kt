package com.voxel.vpn.parser

import java.io.ByteArrayOutputStream

/**
 * A forgiving URI splitter for proxy share links. `java.net.URI` rejects what real links contain
 * (spaces and emoji in the `#name`, unescaped base64 in the user-info), and `android.net.Uri` is
 * not available in JVM unit tests, so links are split by hand.
 */
class LinkUri private constructor(
    val scheme: String,
    /** Raw (still percent-encoded) text before the last `@` of the authority. */
    val userInfo: String?,
    /** Host without IPv6 brackets. */
    val host: String,
    val port: Int?,
    /** Raw path, including the leading `/`; empty when absent. */
    val path: String,
    /** Raw query without `?`. */
    val query: String?,
    /** Percent-decoded fragment. */
    val fragment: String?,
) {
    /** Percent-decoded query parameters; the first occurrence of a key wins. */
    val queryParams: Map<String, String> by lazy {
        val out = LinkedHashMap<String, String>()
        query?.split('&')?.forEach { pair ->
            if (pair.isEmpty()) return@forEach
            val eq = pair.indexOf('=')
            val key = percentDecode(if (eq < 0) pair else pair.substring(0, eq))
            val value = if (eq < 0) "" else percentDecode(pair.substring(eq + 1))
            if (key !in out) out[key] = value
        }
        out
    }

    companion object {
        private val SCHEME = Regex("^[A-Za-z][A-Za-z0-9+.\\-]*$")
        private val BASE64_LIKE = Regex("^[A-Za-z0-9+/=_\\-]+$")

        fun parse(raw: String): LinkUri? {
            val text = raw.trim()
            val schemeEnd = text.indexOf("://")
            if (schemeEnd <= 0) return null
            val scheme = text.substring(0, schemeEnd)
            if (!SCHEME.matches(scheme)) return null

            var rest = text.substring(schemeEnd + 3)
            var fragment: String? = null
            rest.indexOf('#').let { i ->
                if (i >= 0) {
                    fragment = percentDecode(rest.substring(i + 1))
                    rest = rest.substring(0, i)
                }
            }

            // The authority ends at the first '/' or '?'. Exception: base64 user-info written with the
            // standard alphabet can contain '/', e.g. ss://YWVz/Zg==@host:8388 - detect it by the '@'.
            var authorityEnd = rest.indexOfAny(charArrayOf('/', '?'))
            if (authorityEnd >= 0) {
                val at = rest.indexOf('@')
                if (at > authorityEnd && BASE64_LIKE.matches(rest.substring(0, at))) {
                    authorityEnd = rest.indexOfAny(charArrayOf('/', '?'), at + 1)
                }
            }
            val authority = if (authorityEnd < 0) rest else rest.substring(0, authorityEnd)
            var tail = if (authorityEnd < 0) "" else rest.substring(authorityEnd)

            var query: String? = null
            tail.indexOf('?').let { i ->
                if (i >= 0) {
                    query = tail.substring(i + 1)
                    tail = tail.substring(0, i)
                }
            }

            val at = authority.lastIndexOf('@')
            val userInfo = if (at >= 0) authority.substring(0, at) else null
            val hostPort = authority.substring(at + 1)

            var host: String
            var port: Int? = null
            if (hostPort.startsWith("[")) {
                val close = hostPort.indexOf(']')
                if (close < 0) return null
                host = hostPort.substring(1, close)
                val after = hostPort.substring(close + 1)
                if (after.startsWith(":")) {
                    port = after.substring(1).toIntOrNull() ?: return null
                } else if (after.isNotEmpty()) {
                    return null
                }
            } else {
                val firstColon = hostPort.indexOf(':')
                val lastColon = hostPort.lastIndexOf(':')
                if (firstColon >= 0 && firstColon == lastColon) {
                    host = hostPort.substring(0, firstColon)
                    val portText = hostPort.substring(firstColon + 1)
                    if (portText.isNotEmpty()) port = portText.toIntOrNull() ?: return null
                } else {
                    host = hostPort // no port, or a bare IPv6 literal
                }
            }
            if (port != null && port !in 0..65535) return null
            return LinkUri(scheme.lowercase(), userInfo, host.trim(), port, tail, query, fragment)
        }

        /** Percent-decodes [s] as UTF-8. `+` is left alone; malformed escapes are kept verbatim. */
        fun percentDecode(s: String): String {
            if (s.indexOf('%') < 0) return s
            val out = ByteArrayOutputStream(s.length)
            var i = 0
            while (i < s.length) {
                val c = s[i]
                if (c == '%' && i + 2 < s.length && hexVal(s[i + 1]) >= 0 && hexVal(s[i + 2]) >= 0) {
                    out.write(hexVal(s[i + 1]) * 16 + hexVal(s[i + 2]))
                    i += 3
                } else if (Character.isHighSurrogate(c) && i + 1 < s.length && Character.isLowSurrogate(s[i + 1])) {
                    // Copy both halves of a surrogate pair together so the code point survives.
                    out.write(s.substring(i, i + 2).toByteArray(Charsets.UTF_8))
                    i += 2
                } else {
                    out.write(c.toString().toByteArray(Charsets.UTF_8))
                    i++
                }
            }
            return String(out.toByteArray(), Charsets.UTF_8)
        }

        private fun hexVal(c: Char): Int = when (c) {
            in '0'..'9' -> c - '0'
            in 'a'..'f' -> c - 'a' + 10
            in 'A'..'F' -> c - 'A' + 10
            else -> -1
        }
    }
}
