package com.voxel.vpn.parser

import com.voxel.vpn.model.ServerProfile
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject

sealed interface LinkParseResult {
    /** A usable server. [warnings] lists parameters that were dropped or adjusted. */
    data class Ok(val profile: ServerProfile, val warnings: List<String> = emptyList()) : LinkParseResult

    /** A valid link of a kind the core cannot run (SSR, TUIC, h2 transport, ...). */
    data class Skipped(val reason: String) : LinkParseResult

    /** A link of a supported kind that is broken. */
    data class Invalid(val reason: String) : LinkParseResult

    /** Not a proxy share link at all. */
    data object NotALink : LinkParseResult
}

/** Converts proxy share links (vless, vmess, trojan, ss, socks, http) into [ServerProfile]s. */
object ShareLinkParser {
    private val ALLOWED_FLOWS = setOf("xtls-rprx-vision", "xtls-rprx-vision-udp443")
    private val VMESS_SECURITY = setOf("auto", "aes-128-gcm", "chacha20-poly1305", "none", "zero")
    private val SS_METHODS = mapOf(
        "aes-128-gcm" to "aes-128-gcm",
        "aes-256-gcm" to "aes-256-gcm",
        "chacha20-poly1305" to "chacha20-poly1305",
        "chacha20-ietf-poly1305" to "chacha20-poly1305",
        "xchacha20-poly1305" to "xchacha20-poly1305",
        "xchacha20-ietf-poly1305" to "xchacha20-poly1305",
        "2022-blake3-aes-128-gcm" to "2022-blake3-aes-128-gcm",
        "2022-blake3-aes-256-gcm" to "2022-blake3-aes-256-gcm",
        "2022-blake3-chacha20-poly1305" to "2022-blake3-chacha20-poly1305",
    )
    private val UNSUPPORTED_SCHEMES = mapOf(
        "ssr" to "ShadowsocksR is not supported",
        "tuic" to "TUIC is not supported",
        "hysteria" to "Hysteria v1 is not supported",
        "hysteria2" to "Hysteria2 links are not supported yet",
        "hy2" to "Hysteria2 links are not supported yet",
        "wireguard" to "WireGuard links are not supported yet",
        "wg" to "WireGuard links are not supported yet",
        "amneziawg" to "AmneziaWG links are not supported yet",
        "awg" to "AmneziaWG links are not supported yet",
        "socks4" to "SOCKS4 is not supported (SOCKS5 only)",
        "socks4a" to "SOCKS4 is not supported (SOCKS5 only)",
    )

    /** Schemes this parser turns into servers. `http`/`https` only count when they carry credentials. */
    val SUPPORTED_SCHEMES: Set<String> = setOf("vless", "vmess", "trojan", "ss", "socks", "socks5", "http", "https")

    /** Lower-case scheme of [text] when it starts with `scheme://`, else null. */
    fun schemeOf(text: String): String? {
        val t = text.trim()
        val i = t.indexOf("://")
        if (i <= 0) return null
        val scheme = t.substring(0, i)
        if (!scheme.all { it.isLetterOrDigit() || it == '+' || it == '-' || it == '.' }) return null
        return scheme.lowercase()
    }

    /** True when [text] is (or claims to be) a proxy link, including the kinds that get skipped. */
    fun isProxyLink(text: String): Boolean {
        val s = schemeOf(text) ?: return false
        if (s == "http" || s == "https") return hasCredentials(text)
        return s in SUPPORTED_SCHEMES || s in UNSUPPORTED_SCHEMES
    }

    fun parse(raw: String, now: Long = 0L): LinkParseResult {
        val text = raw.trim().trimStart('\uFEFF')
        val scheme = schemeOf(text) ?: return LinkParseResult.NotALink
        UNSUPPORTED_SCHEMES[scheme]?.let { return LinkParseResult.Skipped(it) }
        return try {
            when (scheme) {
                "vless" -> vless(text, now)
                "vmess" -> vmess(text, now)
                "trojan" -> trojan(text, now)
                "ss" -> shadowsocks(text, now)
                "socks", "socks5" -> socks(text, now)
                "http", "https" -> if (hasCredentials(text)) httpProxy(text, scheme == "https", now) else LinkParseResult.NotALink
                else -> LinkParseResult.NotALink
            }
        } catch (e: IllegalArgumentException) {
            LinkParseResult.Invalid(e.message ?: "Malformed link")
        }
    }

    private fun hasCredentials(text: String): Boolean = LinkUri.parse(text)?.userInfo?.isNotEmpty() == true

    // ---- VLESS -----------------------------------------------------------------------------------------------

    private fun vless(raw: String, now: Long): LinkParseResult {
        val u = LinkUri.parse(raw) ?: return LinkParseResult.Invalid("Malformed vless:// link")
        val id = u.userInfo?.let(LinkUri::percentDecode)?.trim().orEmpty()
        if (id.isEmpty()) return LinkParseResult.Invalid("VLESS link has no user id")
        if (u.host.isEmpty()) return LinkParseResult.Invalid("VLESS link has no host")
        val port = u.port ?: 443
        val q = u.queryParams
        val encryption = q["encryption"]?.trim()?.ifEmpty { null } ?: "none"
        val flow = q["flow"]?.trim().orEmpty()
        if (flow.isNotEmpty() && flow !in ALLOWED_FLOWS) return LinkParseResult.Skipped("Unsupported VLESS flow '$flow'")

        val stream = when (val s = StreamBuilder.build(q, u.host, defaultSecurity = "none")) {
            is StreamResult.Ok -> s
            is StreamResult.Unsupported -> return LinkParseResult.Skipped(s.reason)
            is StreamResult.Invalid -> return LinkParseResult.Invalid(s.reason)
        }
        val secured = stream.settings?.get("security") != null
        if (!secured && encryption == "none" && !Hosts.isPrivate(u.host)) {
            return LinkParseResult.Skipped("Xray-core refuses VLESS without TLS/REALITY to a public address")
        }

        val outbound = buildJsonObject {
            put("protocol", "vless")
            putJsonObject("settings") {
                put("address", u.host)
                put("port", port)
                put("id", id)
                put("encryption", encryption)
                if (flow.isNotEmpty()) put("flow", flow)
            }
            stream.settings?.let { put("streamSettings", it) }
        }
        return finish(outbound, u.fragment, stream.warnings, now)
    }

    // ---- VMess -----------------------------------------------------------------------------------------------

    private fun vmess(raw: String, now: Long): LinkParseResult {
        val body = raw.substring(raw.indexOf("://") + 3)
        if (body.contains('@')) {
            val uri = LinkUri.parse(raw)
            if (uri != null && !uri.userInfo.isNullOrEmpty() && uri.host.isNotEmpty()) return vmessUri(uri, now)
        }
        val hash = body.indexOf('#')
        val payload = (if (hash >= 0) body.substring(0, hash) else body).trim().trimEnd('/')
        val nameSuffix = if (hash >= 0) LinkUri.percentDecode(body.substring(hash + 1)) else null
        val json = Base64Codec.decodeToString(payload) ?: return LinkParseResult.Invalid("vmess:// payload is not valid Base64")
        val obj = runCatching { Json.parseToJsonElement(json) }.getOrNull() as? JsonObject
            ?: return LinkParseResult.Invalid("vmess:// payload is not a JSON object")

        fun s(key: String): String = (obj[key] as? JsonPrimitive)?.contentOrNull?.trim().orEmpty()

        val address = s("add")
        val port = s("port").toIntOrNull() ?: return LinkParseResult.Invalid("vmess:// has no valid port")
        val id = s("id")
        if (address.isEmpty() || id.isEmpty()) return LinkParseResult.Invalid("vmess:// needs both 'add' and 'id'")

        val net = s("net").lowercase().ifEmpty { "tcp" }
        val params = LinkedHashMap<String, String>()
        params["type"] = net
        when (net) {
            "grpc", "gun" -> {
                params["serviceName"] = s("path")
                params["mode"] = s("type")
            }
            "kcp", "mkcp" -> {
                params["seed"] = s("path")
                params["headerType"] = s("type")
            }
            else -> {
                params["headerType"] = s("type")
                params["path"] = s("path")
            }
        }
        params["host"] = s("host")
        params["security"] = if (s("tls").equals("tls", ignoreCase = true)) "tls" else "none"
        params["sni"] = s("sni")
        params["alpn"] = s("alpn")
        params["fp"] = s("fp")

        val stream = when (val st = StreamBuilder.build(params, address, defaultSecurity = "none")) {
            is StreamResult.Ok -> st
            is StreamResult.Unsupported -> return LinkParseResult.Skipped(st.reason)
            is StreamResult.Invalid -> return LinkParseResult.Invalid(st.reason)
        }
        val outbound = vmessOutbound(address, port, id, s("scy"), stream.settings)
        return finish(outbound, s("ps").ifEmpty { nameSuffix.orEmpty() }, stream.warnings, now)
    }

    private fun vmessUri(u: LinkUri, now: Long): LinkParseResult {
        val id = LinkUri.percentDecode(u.userInfo.orEmpty()).trim()
        val q = u.queryParams
        val stream = when (val st = StreamBuilder.build(q, u.host, defaultSecurity = "none")) {
            is StreamResult.Ok -> st
            is StreamResult.Unsupported -> return LinkParseResult.Skipped(st.reason)
            is StreamResult.Invalid -> return LinkParseResult.Invalid(st.reason)
        }
        val outbound = vmessOutbound(u.host, u.port ?: 443, id, q["encryption"].orEmpty(), stream.settings)
        return finish(outbound, u.fragment, stream.warnings, now)
    }

    private fun vmessOutbound(address: String, port: Int, id: String, security: String, stream: JsonObject?): JsonObject {
        val scy = security.trim().lowercase().takeIf { it in VMESS_SECURITY } ?: "auto"
        return buildJsonObject {
            put("protocol", "vmess")
            putJsonObject("settings") {
                put("address", address)
                put("port", port)
                put("id", id)
                put("security", scy)
            }
            stream?.let { put("streamSettings", it) }
        }
    }

    // ---- Trojan ----------------------------------------------------------------------------------------------

    private fun trojan(raw: String, now: Long): LinkParseResult {
        val u = LinkUri.parse(raw) ?: return LinkParseResult.Invalid("Malformed trojan:// link")
        val password = u.userInfo?.let(LinkUri::percentDecode).orEmpty()
        if (password.isEmpty()) return LinkParseResult.Invalid("Trojan link has no password")
        if (u.host.isEmpty()) return LinkParseResult.Invalid("Trojan link has no host")
        val stream = when (val s = StreamBuilder.build(u.queryParams, u.host, defaultSecurity = "tls")) {
            is StreamResult.Ok -> s
            is StreamResult.Unsupported -> return LinkParseResult.Skipped(s.reason)
            is StreamResult.Invalid -> return LinkParseResult.Invalid(s.reason)
        }
        if (stream.settings?.get("security") == null && !Hosts.isPrivate(u.host)) {
            return LinkParseResult.Skipped("Xray-core refuses Trojan without TLS/REALITY to a public address")
        }
        val outbound = buildJsonObject {
            put("protocol", "trojan")
            putJsonObject("settings") {
                put("address", u.host)
                put("port", u.port ?: 443)
                put("password", password)
            }
            stream.settings?.let { put("streamSettings", it) }
        }
        return finish(outbound, u.fragment, stream.warnings, now)
    }

    // ---- Shadowsocks -----------------------------------------------------------------------------------------

    private fun shadowsocks(raw: String, now: Long): LinkParseResult {
        var main = raw.substring(raw.indexOf("://") + 3)
        var name: String? = null
        main.indexOf('#').let { i ->
            if (i >= 0) {
                name = LinkUri.percentDecode(main.substring(i + 1))
                main = main.substring(0, i)
            }
        }
        var query: String? = null
        main.indexOf('?').let { i ->
            if (i >= 0) {
                query = main.substring(i + 1)
                main = main.substring(0, i)
            }
        }
        main = main.trimEnd('/')
        if (main.isEmpty()) return LinkParseResult.Invalid("Empty ss:// link")

        val params = LinkedHashMap<String, String>()
        query?.split('&')?.forEach { pair ->
            if (pair.isEmpty()) return@forEach
            val eq = pair.indexOf('=')
            val key = LinkUri.percentDecode(if (eq < 0) pair else pair.substring(0, eq))
            if (key !in params) params[key] = if (eq < 0) "" else LinkUri.percentDecode(pair.substring(eq + 1))
        }
        if (params["plugin"]?.isNotEmpty() == true) {
            return LinkParseResult.Skipped("Shadowsocks plugins (${params["plugin"]!!.substringBefore(';')}) are not supported")
        }

        val methodRaw: String
        val password: String
        val hostPort: String
        val at = main.lastIndexOf('@')
        if (at >= 0) {
            val creds = decodeSsCredentials(main.substring(0, at)) ?: return LinkParseResult.Invalid("ss:// credentials are not valid")
            methodRaw = creds.first
            password = creds.second
            hostPort = main.substring(at + 1)
        } else {
            val decoded = Base64Codec.decodeToString(main) ?: return LinkParseResult.Invalid("ss:// payload is not valid Base64")
            val innerAt = decoded.lastIndexOf('@')
            if (innerAt < 0) return LinkParseResult.Invalid("ss:// payload has no server part")
            val colon = decoded.indexOf(':')
            if (colon < 0 || colon > innerAt) return LinkParseResult.Invalid("ss:// payload has no method:password")
            methodRaw = decoded.substring(0, colon)
            password = decoded.substring(colon + 1, innerAt)
            hostPort = decoded.substring(innerAt + 1)
        }

        val method = SS_METHODS[methodRaw.trim().lowercase()]
            ?: return LinkParseResult.Skipped("Unsupported Shadowsocks cipher '${methodRaw.trim()}'")
        val endpoint = LinkUri.parse("ss://$hostPort") ?: return LinkParseResult.Invalid("ss:// has no valid host:port")
        if (endpoint.host.isEmpty() || endpoint.port == null) return LinkParseResult.Invalid("ss:// has no valid host:port")

        val stream = when (val s = StreamBuilder.build(params, endpoint.host, defaultSecurity = "none")) {
            is StreamResult.Ok -> s
            is StreamResult.Unsupported -> return LinkParseResult.Skipped(s.reason)
            is StreamResult.Invalid -> return LinkParseResult.Invalid(s.reason)
        }
        val outbound = buildJsonObject {
            put("protocol", "shadowsocks")
            putJsonObject("settings") {
                put("address", endpoint.host)
                put("port", endpoint.port)
                put("method", method)
                put("password", password)
            }
            stream.settings?.let { put("streamSettings", it) }
        }
        return finish(outbound, name, stream.warnings, now)
    }

    /** `method:password` either plain (percent-encoded) or Base64 of that text. */
    private fun decodeSsCredentials(userPart: String): Pair<String, String>? {
        val plain = LinkUri.percentDecode(userPart)
        val text = if (plain.contains(':')) plain else Base64Codec.decodeToString(userPart) ?: return null
        val colon = text.indexOf(':')
        if (colon <= 0) return null
        return text.substring(0, colon) to text.substring(colon + 1)
    }

    // ---- SOCKS / HTTP ----------------------------------------------------------------------------------------

    private fun socks(raw: String, now: Long): LinkParseResult {
        val u = LinkUri.parse(raw) ?: return LinkParseResult.Invalid("Malformed socks:// link")
        if (u.host.isEmpty() || u.port == null) return LinkParseResult.Invalid("SOCKS link needs host and port")
        val creds = u.userInfo?.takeIf { it.isNotEmpty() }?.let { info ->
            val plain = LinkUri.percentDecode(info)
            if (plain.contains(':')) {
                plain
            } else {
                Base64Codec.decodeToString(info)?.takeIf { it.contains(':') } ?: plain
            }
        }
        val user = creds?.substringBefore(':')
        val pass = creds?.substringAfter(':', "")
        val outbound = buildJsonObject {
            put("protocol", "socks")
            putJsonObject("settings") {
                put("address", u.host)
                put("port", u.port)
                if (!user.isNullOrEmpty()) {
                    put("user", user)
                    put("pass", pass.orEmpty())
                }
            }
        }
        return finish(outbound, u.fragment, emptyList(), now)
    }

    private fun httpProxy(raw: String, tls: Boolean, now: Long): LinkParseResult {
        val u = LinkUri.parse(raw) ?: return LinkParseResult.Invalid("Malformed http:// link")
        if (u.host.isEmpty()) return LinkParseResult.Invalid("HTTP proxy link has no host")
        val creds = LinkUri.percentDecode(u.userInfo.orEmpty())
        val user = creds.substringBefore(':')
        val pass = creds.substringAfter(':', "")
        val outbound = buildJsonObject {
            put("protocol", "http")
            putJsonObject("settings") {
                put("address", u.host)
                put("port", u.port ?: if (tls) 443 else 80)
                put("user", user)
                put("pass", pass)
            }
            if (tls) {
                putJsonObject("streamSettings") {
                    put("network", "tcp")
                    put("security", "tls")
                    putJsonObject("tlsSettings") {
                        if (!Hosts.isIpLiteral(u.host)) put("serverName", u.host)
                        put("fingerprint", "chrome")
                        putJsonArray("alpn") { add(JsonPrimitive("http/1.1")) }
                    }
                }
            }
        }
        return finish(outbound, u.fragment, emptyList(), now)
    }

    // ---- shared ----------------------------------------------------------------------------------------------

    private fun finish(outbound: JsonObject, name: String?, warnings: List<String>, now: Long): LinkParseResult {
        val profile = ServerProfile.fromOutbound(outbound, name, now)
            ?: return LinkParseResult.Invalid("Link has no readable server address")
        if (profile.port !in 1..65535) return LinkParseResult.Invalid("Port ${profile.port} is out of range")
        return LinkParseResult.Ok(profile, warnings)
    }
}
