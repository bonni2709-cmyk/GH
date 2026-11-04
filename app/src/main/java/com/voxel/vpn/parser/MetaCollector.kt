package com.voxel.vpn.parser

import com.voxel.vpn.model.SubscriptionMeta
import com.voxel.vpn.model.UserInfo

/**
 * Gathers subscription metadata from two places - HTTP response headers and `#key: value` lines
 * inside the body - and turns it into a [SubscriptionMeta]. Headers win over inline lines.
 */
class MetaCollector {
    private val values = LinkedHashMap<String, String>()

    /** Registers an HTTP header (always overrides inline metadata). */
    fun putHeader(name: String, value: String) {
        values[name.trim().lowercase()] = decodeValue(value.trim())
    }

    /** Registers a body line such as `#profile-title: My VPN`; returns true when it was metadata. */
    fun putInlineLine(line: String): Boolean {
        val m = INLINE.matchEntire(line.trim()) ?: return false
        val key = m.groupValues[1].lowercase()
        val value = m.groupValues[2].trim()
        if (key !in values) values[key] = decodeValue(value)
        return true
    }

    fun build(): SubscriptionMeta {
        val titleSource = values["profile-title"] ?: values["subscription-name"] ?: filenameFromDisposition()
        val titleLines = titleSource?.lines()?.map { it.trim() }?.filter { it.isNotEmpty() }.orEmpty()
        val title = titleLines.firstOrNull()?.take(100)
        val titleDescription = titleLines.drop(1).joinToString("\n").ifEmpty { null }

        val userInfoRaw = values["subscription-userinfo"]
        val hideTraffic = userInfoRaw?.trim() == "0"

        val consumed = setOf(
            "profile-title", "subscription-name", "profile-description", "profile-update-interval", "subscription-userinfo",
            "announce", "announce-url", "support-url", "support-email", "profile-web-page-url", "homepage", "sort-order",
            "hide-url", "routing", "autorouting", "content-disposition",
        )
        val extra = values.filter { (k, _) ->
            k !in consumed && EXTRA_PREFIXES.any { k == it || k.startsWith(it) }
        }

        return SubscriptionMeta(
            title = title,
            description = (values["profile-description"] ?: titleDescription)?.trim()?.ifEmpty { null },
            updateIntervalHours = values["profile-update-interval"]?.trim()?.toDoubleOrNull()?.let { Math.round(it).toInt().coerceAtLeast(1) },
            userInfo = if (hideTraffic) null else userInfoRaw?.let(::parseUserInfo),
            hideTraffic = hideTraffic,
            announce = values["announce"]?.trim()?.take(200)?.ifEmpty { null },
            announceUrl = values["announce-url"]?.trim()?.ifEmpty { null },
            supportUrl = values["support-url"]?.trim()?.ifEmpty { null },
            supportEmail = values["support-email"]?.trim()?.ifEmpty { null },
            webPageUrl = (values["profile-web-page-url"] ?: values["homepage"])?.trim()?.ifEmpty { null },
            sortOrder = values["sort-order"]?.trim()?.lowercase()?.takeIf { it == "ping" || it == "name" || it == "none" },
            hideUrl = isTrue(values["hide-url"]),
            routing = values["routing"]?.trim()?.ifEmpty { null },
            autoRouting = values["autorouting"]?.trim()?.ifEmpty { null },
            extra = extra,
        )
    }

    private fun filenameFromDisposition(): String? {
        val header = values["content-disposition"] ?: return null
        val star = FILENAME_STAR.find(header)?.groupValues?.get(1)
        val plain = FILENAME.find(header)?.groupValues?.get(1)
        val raw = when {
            star != null -> LinkUri.percentDecode(star)
            plain != null -> plain
            else -> return null
        }
        return raw.trim().trim('"').removeSuffix(".txt").removeSuffix(".yaml").removeSuffix(".yml").ifEmpty { null }
    }

    companion object {
        private val INLINE = Regex("^(?:#|//)\\s*([A-Za-z][A-Za-z0-9_\\-]*)\\s*:\\s*(.*)$")
        private val FILENAME_STAR = Regex("filename\\*\\s*=\\s*[^']*'[^']*'([^;]+)", RegexOption.IGNORE_CASE)
        private val FILENAME = Regex("filename\\s*=\\s*\"?([^\";]+)\"?", RegexOption.IGNORE_CASE)
        private val EXTRA_PREFIXES = listOf(
            "fragmentation-", "noises-", "server-address-resolve-", "per-app-proxy-", "banner-", "premium-url",
            "no-limit-enabled", "update-always", "ping-type", "test-url",
        )

        /** `base64:` prefixed values are decoded; anything undecodable is kept verbatim. */
        internal fun decodeValue(value: String): String {
            if (!value.startsWith("base64:", ignoreCase = true)) return value
            val payload = value.substring("base64:".length).trim()
            return Base64Codec.decodeToString(payload) ?: value
        }

        /** `upload=1; download=2; total=3; expire=4` (expire in seconds, or milliseconds when above 32e9). */
        fun parseUserInfo(raw: String): UserInfo? {
            val map = HashMap<String, Long>()
            raw.split(';').forEach { part ->
                val eq = part.indexOf('=')
                if (eq <= 0) return@forEach
                val key = part.substring(0, eq).trim().lowercase()
                val text = part.substring(eq + 1).trim()
                val num = text.toLongOrNull() ?: text.toDoubleOrNull()?.toLong() ?: return@forEach
                map[key] = num
            }
            if (map.isEmpty()) return null
            val expire = map["expire"]?.let { if (it > 32_000_000_000L) it / 1000 else it }?.takeIf { it > 0 }
            return UserInfo(
                upload = map["upload"] ?: 0L,
                download = map["download"] ?: 0L,
                total = map["total"] ?: 0L,
                expireAt = expire,
            )
        }

        private fun isTrue(v: String?): Boolean = v != null && (v.trim() == "1" || v.trim().equals("true", ignoreCase = true) || v.trim().equals("yes", ignoreCase = true))
    }
}
