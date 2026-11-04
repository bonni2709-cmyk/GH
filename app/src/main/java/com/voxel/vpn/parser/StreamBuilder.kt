package com.voxel.vpn.parser

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject

internal sealed interface StreamResult {
    /** [settings] is null when the link means plain TCP without security (no `streamSettings` needed). */
    data class Ok(val settings: JsonObject?, val warnings: List<String> = emptyList()) : StreamResult
    data class Unsupported(val reason: String) : StreamResult
    data class Invalid(val reason: String) : StreamResult
}

/**
 * Turns the transport/security parameters shared by VLESS, VMess, Trojan and Shadowsocks share
 * links (`type`, `security`, `sni`, `pbk`, ...) into an Xray `streamSettings` object, using the
 * field names of the pinned Xray-core version.
 */
internal object StreamBuilder {
    private val SHORT_ID = Regex("^(?:[0-9a-fA-F]{2}){0,8}$")
    private val FORBIDDEN_REALITY_FP = setOf("unsafe", "hellogolang")

    fun build(p: Map<String, String>, serverHost: String, defaultSecurity: String): StreamResult {
        val warnings = ArrayList<String>()

        val typeRaw = p["type"]?.trim()?.lowercase().orEmpty()
        val network = when (typeRaw) {
            "", "tcp", "raw" -> "tcp"
            "ws", "websocket" -> "ws"
            "grpc", "gun" -> "grpc"
            "httpupgrade" -> "httpupgrade"
            "xhttp", "splithttp" -> "xhttp"
            "kcp", "mkcp" -> "kcp"
            "h2", "h3", "http" -> return StreamResult.Unsupported(
                "The HTTP/2 transport ('$typeRaw') was removed from Xray-core; the server must offer XHTTP or TCP",
            )
            "quic" -> return StreamResult.Unsupported("The QUIC transport was removed from Xray-core")
            else -> return StreamResult.Unsupported("Unknown transport '$typeRaw'")
        }

        val securityRaw = p["security"]?.trim()?.lowercase()?.ifEmpty { null } ?: defaultSecurity
        val security = when (securityRaw) {
            "", "none" -> "none"
            "tls", "xtls" -> "tls"
            "reality" -> "reality"
            else -> return StreamResult.Unsupported("Unknown security '$securityRaw'")
        }

        val host = p["host"].orEmpty().trim()
        val path = p["path"].orEmpty()

        val transport: Pair<String, JsonObject>? = when (network) {
            "tcp" -> when (val header = p["headerType"]?.trim()?.lowercase().orEmpty()) {
                "", "none" -> null
                "http" -> "tcpSettings" to tcpHttpHeader(host, path)
                else -> return StreamResult.Unsupported("TCP header type '$header' is not supported")
            }
            "ws" -> "wsSettings" to buildJsonObject {
                put("path", path.ifEmpty { "/" })
                if (host.isNotEmpty()) put("host", host)
            }
            "grpc" -> "grpcSettings" to buildJsonObject {
                put("serviceName", p["serviceName"].orEmpty())
                put("multiMode", p["mode"].equals("multi", ignoreCase = true))
                p["authority"]?.takeIf { it.isNotEmpty() }?.let { put("authority", it) }
            }
            "httpupgrade" -> "httpupgradeSettings" to buildJsonObject {
                put("path", path.ifEmpty { "/" })
                if (host.isNotEmpty()) put("host", host)
            }
            "xhttp" -> "xhttpSettings" to buildJsonObject {
                put("path", path.ifEmpty { "/" })
                if (host.isNotEmpty()) put("host", host)
                p["mode"]?.takeIf { it.isNotEmpty() }?.let { put("mode", it) }
                p["extra"]?.takeIf { it.isNotEmpty() }?.let { extra ->
                    val parsed = runCatching { Json.parseToJsonElement(extra) }.getOrNull()
                    if (parsed is JsonObject) put("extra", parsed) else warnings.add("XHTTP 'extra' is not a JSON object and was ignored")
                }
            }
            "kcp" -> {
                val header = p["headerType"]?.trim()?.lowercase().orEmpty()
                if (header != "" && header != "none") {
                    return StreamResult.Unsupported("mKCP header type '$header' is not supported")
                }
                "kcpSettings" to buildJsonObject {
                    p["seed"]?.takeIf { it.isNotEmpty() }?.let { put("seed", it) }
                }
            }
            else -> null
        }

        val securitySettings: Pair<String, JsonObject>? = when (security) {
            "tls" -> "tlsSettings" to tlsSettings(p, serverHost, host, warnings)
            "reality" -> {
                when (val r = realitySettings(p, serverHost)) {
                    is Built.Fail -> return StreamResult.Invalid(r.reason)
                    is Built.Done -> {
                        warnings.addAll(r.warnings)
                        "realitySettings" to r.value
                    }
                }
            }
            else -> null
        }

        if (network == "tcp" && security == "none" && transport == null) return StreamResult.Ok(null, warnings)

        val stream = buildJsonObject {
            put("network", network)
            if (security != "none") put("security", security)
            transport?.let { (key, value) -> put(key, value) }
            securitySettings?.let { (key, value) -> put(key, value) }
        }
        return StreamResult.Ok(stream, warnings)
    }

    private fun tcpHttpHeader(host: String, path: String): JsonObject = buildJsonObject {
        putJsonObject("header") {
            put("type", "http")
            putJsonObject("request") {
                put(
                    "path",
                    buildJsonArray {
                        (path.ifEmpty { "/" }).split(',').map { it.trim() }.filter { it.isNotEmpty() }.forEach { add(it) }
                    },
                )
                if (host.isNotEmpty()) {
                    putJsonObject("headers") {
                        put(
                            "Host",
                            buildJsonArray { host.split(',').map { it.trim() }.filter { it.isNotEmpty() }.forEach { add(it) } },
                        )
                    }
                }
            }
        }
    }

    private fun tlsSettings(p: Map<String, String>, serverHost: String, hostParam: String, warnings: MutableList<String>): JsonObject {
        val sni = firstNonEmpty(p["sni"], p["peer"], hostParam, if (!Hosts.isIpLiteral(serverHost)) serverHost else null)
        val fp = p["fp"]?.trim()?.lowercase()?.ifEmpty { null } ?: "chrome"
        val alpn = p["alpn"]?.split(',')?.map { it.trim() }?.filter { it.isNotEmpty() }.orEmpty()
        if (isTrue(p["allowInsecure"]) || isTrue(p["insecure"])) {
            warnings.add("allowInsecure is not supported by Xray-core 26.x; the certificate is still verified")
        }
        return buildJsonObject {
            if (sni.isNotEmpty()) put("serverName", sni)
            put("fingerprint", fp)
            if (alpn.isNotEmpty()) put("alpn", buildJsonArray { alpn.forEach { add(it) } })
            p["pcs"]?.takeIf { it.isNotBlank() }?.let { put("pinnedPeerCertSha256", it.trim()) }
            p["vcn"]?.takeIf { it.isNotBlank() }?.let { put("verifyPeerCertByName", it.trim()) }
            p["ech"]?.takeIf { it.isNotBlank() }?.let { put("echConfigList", it.trim()) }
        }
    }

    private sealed interface Built {
        data class Done(val value: JsonObject, val warnings: List<String> = emptyList()) : Built
        data class Fail(val reason: String) : Built
    }

    private fun realitySettings(p: Map<String, String>, serverHost: String): Built {
        val warnings = ArrayList<String>()
        val pbkRaw = firstNonEmpty(p["pbk"], p["publicKey"], p["password"])
        if (pbkRaw.isEmpty()) return Built.Fail("REALITY link has no public key (pbk)")
        val pbk = normalizeKey(pbkRaw) ?: return Built.Fail("REALITY public key is not a valid 32-byte Base64 value")

        val sid = p["sid"]?.trim().orEmpty()
        if (!SHORT_ID.matches(sid)) return Built.Fail("REALITY short id must be 0-16 hex characters (even length): '$sid'")

        var fp = p["fp"]?.trim()?.lowercase()?.ifEmpty { null } ?: "chrome"
        if (fp in FORBIDDEN_REALITY_FP) {
            warnings.add("Fingerprint '$fp' is not allowed with REALITY; using chrome")
            fp = "chrome"
        }

        var spx = p["spx"]?.trim().orEmpty()
        if (spx.isNotEmpty() && !spx.startsWith("/")) spx = "/$spx"

        val sni = firstNonEmpty(p["sni"], if (!Hosts.isIpLiteral(serverHost)) serverHost else null)
        val value = buildJsonObject {
            put("serverName", sni)
            put("fingerprint", fp)
            put("publicKey", pbk)
            put("shortId", sid)
            put("spiderX", spx.ifEmpty { "/" })
            p["pqv"]?.takeIf { it.isNotBlank() }?.let { put("mldsa65Verify", it.trim()) }
        }
        return Built.Done(value, warnings)
    }

    /** REALITY keys are raw URL-safe Base64 of 32 bytes; links sometimes carry padded or standard-alphabet text. */
    internal fun normalizeKey(raw: String): String? {
        val bytes = Base64Codec.decode(raw) ?: return null
        if (bytes.size != 32) return null
        return Base64Codec.encodeUrlSafe(bytes)
    }

    private fun firstNonEmpty(vararg values: String?): String = values.firstOrNull { !it.isNullOrBlank() }?.trim().orEmpty()

    private fun isTrue(v: String?): Boolean = v != null && (v == "1" || v.equals("true", ignoreCase = true))
}

/** Small host helpers shared by the parsers. */
internal object Hosts {
    private val IPV4 = Regex("^(?:\\d{1,3}\\.){3}\\d{1,3}$")

    fun isIpLiteral(host: String): Boolean = IPV4.matches(host) || host.contains(':')

    /**
     * Mirrors the check Xray-core applies before it accepts VLESS/Trojan without TLS: only private,
     * loopback and link-local IPs and local-looking names are exempt.
     */
    fun isPrivate(host: String): Boolean {
        val h = host.trim().trimEnd('.').lowercase()
        if (IPV4.matches(h)) {
            val o = h.split('.').map { it.toIntOrNull() ?: return false }
            return o[0] == 10 || o[0] == 127 ||
                (o[0] == 172 && o[1] in 16..31) ||
                (o[0] == 192 && o[1] == 168) ||
                (o[0] == 169 && o[1] == 254)
        }
        if (h.contains(':')) {
            return h == "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")
        }
        return h == "localhost" || LOCAL_SUFFIXES.any { h.endsWith(it) }
    }

    private val LOCAL_SUFFIXES = listOf(".local", ".lan", ".internal", ".localdomain", ".home.arpa", ".intranet", ".private")
}
