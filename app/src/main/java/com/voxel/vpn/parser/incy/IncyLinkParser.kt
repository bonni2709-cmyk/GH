package com.voxel.vpn.parser.incy

import com.voxel.vpn.parser.Base64Codec
import com.voxel.vpn.parser.LinkUri
import com.voxel.vpn.parser.ShareLinkParser

enum class ControlAction { CONNECT, OPEN, DISCONNECT, CLOSE, TOGGLE, STATUS }

/** What an INCY link (or pasted text) asks the app to do. */
sealed interface IncyCommand {
    /** `incy://connect|open|disconnect|close|toggle|status`. */
    data class Control(val action: ControlAction) : IncyCommand

    /** One or more remote subscriptions to download. [nameHint] only applies to a single URL. */
    data class Subscriptions(val urls: List<String>, val nameHint: String?, val origin: String) : IncyCommand

    /** Content that is imported as it is: share links, full Xray configs or a subscription body. */
    data class Inline(val text: String, val origin: String) : IncyCommand
}

/**
 * Understands the INCY deep-link family and the loose text people paste:
 *
 * - `incy://crypt1/{payload}` - encrypted subscription URL
 * - `incy://add/{url}`, `incy://add?url=...` - subscription URL
 * - `incy://import/{data}` - auto-detected: subscription URL, share link(s), config, Base64 of those
 * - `incy://connect|open|disconnect|close|toggle|status` - control actions
 * - a bare `https://...` subscription URL, several URLs, or any share link / config text
 */
object IncyLinkParser {
    private const val SCHEME_PREFIX = "incy://"
    private const val MAX_DEPTH = 4
    private val CRYPT_VERSION = Regex("^crypt(\\d+)$", RegexOption.IGNORE_CASE)
    private val ROUTING_HOSTS = setOf("routing", "autorouting", "onadd")

    fun isIncyLink(text: String): Boolean = text.trim().startsWith(SCHEME_PREFIX, ignoreCase = true)

    fun parse(input: String): IncyCommand {
        val text = input.trim().trimStart('\uFEFF').trim()
        if (text.isEmpty()) throw IncyLinkException(IncyLinkException.Kind.EMPTY, "Nothing to import")
        return if (isIncyLink(text)) parseIncy(text, depth = 0) else classifyPlain(text, origin = "paste", depth = 0)
    }

    private fun parseIncy(text: String, depth: Int): IncyCommand {
        if (depth > MAX_DEPTH) throw IncyLinkException(IncyLinkException.Kind.MALFORMED, "Links are nested too deeply")
        val rest = text.substring(SCHEME_PREFIX.length)
        val hostEnd = rest.indexOfAny(charArrayOf('/', '?', '#')).let { if (it < 0) rest.length else it }
        val host = rest.substring(0, hostEnd).lowercase()
        val tail = rest.substring(hostEnd)

        ControlAction.entries.firstOrNull { it.name.equals(host, ignoreCase = true) }?.let { return IncyCommand.Control(it) }

        CRYPT_VERSION.matchEntire(host)?.let { m ->
            if (m.groupValues[1] != "1") {
                throw IncyLinkException(
                    IncyLinkException.Kind.UNSUPPORTED_VERSION,
                    "Link scheme '$host' is newer than this app understands (crypt1 only)",
                )
            }
            val payload = IncyCrypt1.decode(tail.removePrefix("/"))
            return subscriptionFrom(payload.url, payload.name, origin = "incy:crypt1", depth = depth + 1)
        }

        return when (host) {
            "add" -> addCommand(tail, depth + 1)
            "import" -> classifyPlain(dataOf(tail), origin = "incy:import", depth = depth + 1)
            in ROUTING_HOSTS -> throw IncyLinkException(
                IncyLinkException.Kind.UNSUPPORTED,
                "Routing links are not supported by this build",
            )
            "" -> throw IncyLinkException(IncyLinkException.Kind.EMPTY, "The incy:// link has no action")
            else -> throw IncyLinkException(IncyLinkException.Kind.MALFORMED, "Unknown INCY link action '$host'")
        }
    }

    /** `add/{url}` (raw or percent-encoded) or `add?url={encoded}`. */
    private fun addCommand(tail: String, depth: Int): IncyCommand {
        val data = if (tail.startsWith("?")) {
            val params = LinkUri.parse("incy://x$tail")?.queryParams.orEmpty()
            params["url"] ?: params["data"] ?: throw IncyLinkException(IncyLinkException.Kind.MALFORMED, "add link has no url parameter")
        } else {
            dataOf(tail)
        }
        if (data.isEmpty()) throw IncyLinkException(IncyLinkException.Kind.EMPTY, "add link has no url")
        val command = classifyPlain(data, origin = "incy:add", depth = depth)
        if (command !is IncyCommand.Subscriptions) {
            throw IncyLinkException(IncyLinkException.Kind.MALFORMED, "add expects a subscription URL")
        }
        return command
    }

    /** The data part of `import/{data}`: drop the leading slash, then percent-decode when the whole value is encoded. */
    private fun dataOf(tail: String): String {
        var d = tail.removePrefix("/")
        if (d.startsWith("?")) {
            val params = LinkUri.parse("incy://x$d")?.queryParams.orEmpty()
            d = params["data"] ?: params["url"] ?: d.removePrefix("?")
        } else if (d.contains('%') && !d.contains("://")) {
            // Fully percent-encoded data (https%3A%2F%2F...). Raw links keep their own escapes untouched.
            d = LinkUri.percentDecode(d)
        }
        return d.trim()
    }

    private fun classifyPlain(data: String, origin: String, depth: Int): IncyCommand {
        val text = data.trim()
        if (text.isEmpty()) throw IncyLinkException(IncyLinkException.Kind.EMPTY, "Nothing to import")

        if (isIncyLink(text)) return parseIncy(text, depth + 1)

        // Subscription URL(s): every token is an http(s) URL without credentials.
        val tokens = text.split(Regex("\\s+")).filter { it.isNotEmpty() }
        if (tokens.isNotEmpty() && tokens.all { isSubscriptionUrl(it) }) {
            val urls = tokens.map { it.substringBefore('#') }.distinct()
            val hint = if (urls.size == 1) tokens.first().substringAfter('#', "").let { LinkUri.percentDecode(it) }.ifEmpty { null } else null
            return IncyCommand.Subscriptions(urls, hint, origin)
        }

        // Anything that already looks like links, configs or a body is imported inline.
        if (text.lineSequence().any { ShareLinkParser.isProxyLink(it) } ||
            text.startsWith("{") || text.startsWith("[") || text.contains("#profile-title", ignoreCase = true)
        ) {
            return IncyCommand.Inline(text, origin)
        }

        // Base64 of one of the above.
        if (depth < MAX_DEPTH && Base64Codec.looksLikeBase64(text)) {
            val decoded = Base64Codec.decodeToString(text)
            if (decoded != null && decoded.isNotBlank()) return classifyPlain(decoded, origin, depth + 1)
        }
        return IncyCommand.Inline(text, origin)
    }

    private fun isSubscriptionUrl(token: String): Boolean {
        val scheme = ShareLinkParser.schemeOf(token) ?: return false
        if (scheme != "http" && scheme != "https") return false
        val uri = LinkUri.parse(token) ?: return false
        return uri.host.isNotEmpty() && uri.userInfo.isNullOrEmpty()
    }

    private fun subscriptionFrom(url: String, name: String?, origin: String, depth: Int): IncyCommand {
        val inner = classifyPlain(url, origin, depth)
        return if (inner is IncyCommand.Subscriptions) {
            inner.copy(nameHint = name ?: inner.nameHint)
        } else {
            // The decrypted payload was not a URL (e.g. a server link): import it directly.
            inner
        }
    }
}
