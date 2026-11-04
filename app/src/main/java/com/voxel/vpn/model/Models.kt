package com.voxel.vpn.model

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import java.security.MessageDigest

/**
 * One connectable server. The canonical representation is the Xray outbound object itself
 * ([outbound], without a `tag`): share links are converted to it at import time, and full Xray
 * configs from subscriptions are kept as they are. The remaining fields are a display summary.
 */
@Serializable
data class ServerProfile(
    val id: String,
    val name: String,
    /** Xray protocol name: vless, vmess, trojan, shadowsocks, socks, http, ... */
    val protocol: String,
    val host: String,
    val port: Int,
    /** Transport: tcp, ws, grpc, httpupgrade, xhttp, kcp, ... */
    val network: String = "tcp",
    /** none, tls or reality. */
    val security: String = "none",
    val outbound: JsonObject,
    val subscriptionId: String? = null,
    val addedAt: Long = 0L,
) {
    /** `host:port`, with IPv6 literals in brackets. */
    val endpoint: String
        get() = if (host.contains(':')) "[$host]:$port" else "$host:$port"

    /** True when a plain TCP connect to [endpoint] says something about reachability. */
    val tcpProbeable: Boolean
        get() = protocol != "hysteria" && protocol != "wireguard" && network != "kcp" && network != "hysteria"

    /** Same server, owned by [subscriptionId]; the id is re-derived so identical servers of two subscriptions stay distinct. */
    fun attachTo(subscriptionId: String): ServerProfile =
        copy(subscriptionId = subscriptionId, id = Hashing.shortId("$subscriptionId|$id"))

    companion object {
        /**
         * Builds a profile from an Xray outbound. Returns null when the outbound has no
         * recognisable protocol or server endpoint.
         */
        fun fromOutbound(outbound: JsonObject, name: String?, now: Long = 0L): ServerProfile? {
            val protocol = (outbound["protocol"] as? JsonPrimitive)?.contentOrNull?.lowercase() ?: return null
            val endpoint = OutboundSummary.endpointOf(outbound, protocol) ?: return null
            val stream = outbound["streamSettings"] as? JsonObject
            val network = (stream?.get("network") as? JsonPrimitive)?.contentOrNull?.lowercase()?.ifBlank { null } ?: "tcp"
            val security = (stream?.get("security") as? JsonPrimitive)?.contentOrNull?.lowercase()?.ifBlank { null } ?: "none"
            val cleanName = sanitizeName(name) ?: "${endpoint.first}:${endpoint.second}"
            return ServerProfile(
                id = Hashing.shortId(outbound.canonical()),
                name = cleanName,
                protocol = protocol,
                host = endpoint.first,
                port = endpoint.second,
                network = network,
                security = security,
                outbound = outbound,
                addedAt = now,
            )
        }

        fun sanitizeName(raw: String?): String? {
            if (raw == null) return null
            val cleaned = raw.map { if (it.isISOControl()) ' ' else it }.joinToString("").replace(Regex("\\s+"), " ").trim()
            if (cleaned.isEmpty()) return null
            return if (cleaned.length > 100) cleaned.substring(0, 100).trimEnd() else cleaned
        }
    }
}

/** Reads the server endpoint out of the different outbound `settings` shapes Xray accepts. */
internal object OutboundSummary {
    fun endpointOf(outbound: JsonObject, protocol: String): Pair<String, Int>? {
        val settings = outbound["settings"] as? JsonObject ?: return null
        flat(settings)?.let { return it }
        for (key in listOf("vnext", "servers")) {
            val first = (settings[key] as? JsonArray)?.firstOrNull() as? JsonObject ?: continue
            flat(first)?.let { return it }
        }
        if (protocol == "wireguard") {
            val peer = (settings["peers"] as? JsonArray)?.firstOrNull() as? JsonObject
            val endpoint = (peer?.get("endpoint") as? JsonPrimitive)?.contentOrNull ?: return null
            return splitHostPort(endpoint)
        }
        return null
    }

    private fun flat(obj: JsonObject): Pair<String, Int>? {
        val address = (obj["address"] as? JsonPrimitive)?.contentOrNull?.ifBlank { null } ?: return null
        val port = (obj["port"] as? JsonPrimitive)?.let { it.intOrNull ?: it.contentOrNull?.toIntOrNull() } ?: return null
        return address.removePrefix("[").removeSuffix("]") to port
    }

    private fun splitHostPort(value: String): Pair<String, Int>? {
        val v = value.trim()
        if (v.startsWith("[")) {
            val close = v.indexOf(']')
            if (close < 0) return null
            val port = v.substring(close + 1).removePrefix(":").toIntOrNull() ?: return null
            return v.substring(1, close) to port
        }
        val colon = v.lastIndexOf(':')
        if (colon <= 0) return null
        val port = v.substring(colon + 1).toIntOrNull() ?: return null
        return v.substring(0, colon) to port
    }
}

/** A subscription (or a bundle of directly imported links). */
@Serializable
data class Subscription(
    val id: String,
    val title: String,
    /** Remote source that can be refreshed; null for servers imported from literal links. */
    val url: String? = null,
    /** How it got here, e.g. `incy:crypt1`, `incy:add`, `paste`. */
    val origin: String = "paste",
    val updatedAt: Long = 0L,
    val meta: SubscriptionMeta = SubscriptionMeta(),
)

/** Provider supplied metadata (HTTP headers and `#key: value` body lines). */
@Serializable
data class SubscriptionMeta(
    val title: String? = null,
    val description: String? = null,
    val updateIntervalHours: Int? = null,
    val userInfo: UserInfo? = null,
    /** `subscription-userinfo: 0` means "do not show the traffic block". */
    val hideTraffic: Boolean = false,
    val announce: String? = null,
    val announceUrl: String? = null,
    val supportUrl: String? = null,
    val supportEmail: String? = null,
    val webPageUrl: String? = null,
    val sortOrder: String? = null,
    val hideUrl: Boolean = false,
    /** Raw routing profile (base64 JSON or link) as sent by the provider; consumed by the routing module. */
    val routing: String? = null,
    val autoRouting: String? = null,
    /** Everything else worth keeping: fragmentation-*, noises-*, per-app-proxy-*, banner-* ... */
    val extra: Map<String, String> = emptyMap(),
)

@Serializable
data class UserInfo(
    val upload: Long = 0L,
    val download: Long = 0L,
    val total: Long = 0L,
    /** Unix seconds; null when the provider did not send an expiry. */
    val expireAt: Long? = null,
) {
    val used: Long get() = upload + download
}

/** User-tunable settings. */
@Serializable
data class AppSettings(
    val selectedServerId: String? = null,
    /** Capture IPv6 and let the DNS resolver return AAAA records. */
    val ipv6: Boolean = false,
    val logLevel: String = "warning",
    /** DPI bypass level: `off`, `light`, `standard`, `strong` or `custom` (see `DpiMode`). */
    val dpiMode: String = "off",
    /** The strategy text used when [dpiMode] is `custom`. */
    val dpiCustom: String = "",
)

/** Everything the app persists. */
@Serializable
data class AppData(
    val subscriptions: List<Subscription> = emptyList(),
    val servers: List<ServerProfile> = emptyList(),
    val settings: AppSettings = AppSettings(),
) {
    fun serversOf(subscriptionId: String): List<ServerProfile> = servers.filter { it.subscriptionId == subscriptionId }
    fun server(id: String?): ServerProfile? = if (id == null) null else servers.firstOrNull { it.id == id }
}

internal object Hashing {
    private val HEX = "0123456789abcdef".toCharArray()

    fun sha256(bytes: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(bytes)

    fun toHex(bytes: ByteArray): String {
        val out = CharArray(bytes.size * 2)
        for (i in bytes.indices) {
            val v = bytes[i].toInt() and 0xFF
            out[i * 2] = HEX[v ushr 4]
            out[i * 2 + 1] = HEX[v and 0x0F]
        }
        return String(out)
    }

    /** 16 hex chars of the SHA-256 of [text]: a stable, compact id. */
    fun shortId(text: String): String = toHex(sha256(text.toByteArray(Charsets.UTF_8))).substring(0, 16)
}

/** Deterministic JSON text: object keys sorted recursively. Used to derive stable ids. */
fun JsonElement.canonical(): String = when (this) {
    is JsonObject -> keys.sorted().joinToString(",", "{", "}") { k -> "${JsonPrimitive(k)}:${getValue(k).canonical()}" }
    is JsonArray -> joinToString(",", "[", "]") { it.canonical() }
    else -> toString()
}
