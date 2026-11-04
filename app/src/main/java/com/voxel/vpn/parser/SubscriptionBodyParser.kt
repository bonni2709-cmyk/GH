package com.voxel.vpn.parser

import com.voxel.vpn.model.ServerProfile
import com.voxel.vpn.model.SubscriptionMeta
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

/** A subscription entry that was recognised but could not become a server. */
data class SkippedEntry(val source: String, val reason: String)

/** `://routing/onadd/{b64}`-style directive found inside a subscription body. */
data class RoutingDirective(val raw: String, val auto: Boolean, val activate: Boolean)

data class ParsedSubscription(
    val servers: List<ServerProfile>,
    val meta: SubscriptionMeta,
    val skipped: List<SkippedEntry>,
    val routing: List<RoutingDirective>,
    val warnings: List<String>,
)

/**
 * Parses a subscription body in any of the formats the INCY/Happ/v2rayTun ecosystem serves:
 * Base64 of links, plain lines, a JSON array of Xray configs, a single Xray config, or a mix with
 * `#key: value` metadata and routing directives. Response headers, when given, override inline metadata.
 */
class SubscriptionBodyParser(private val clock: () -> Long = { System.currentTimeMillis() }) {
    private class Ctx {
        val servers = ArrayList<ServerProfile>()
        val skipped = ArrayList<SkippedEntry>()
        val routing = ArrayList<RoutingDirective>()
        val warnings = ArrayList<String>()
        val meta = MetaCollector()
    }

    fun parse(body: String, headers: Map<String, String> = emptyMap()): ParsedSubscription {
        val ctx = Ctx()
        ingest(body, ctx, depth = 0)
        headers.forEach { (k, v) -> ctx.meta.putHeader(k, v) }

        val seen = HashSet<String>()
        val unique = ctx.servers.filter { seen.add(it.id) }
        return ParsedSubscription(unique, ctx.meta.build(), ctx.skipped, ctx.routing, ctx.warnings)
    }

    private fun ingest(text: String, ctx: Ctx, depth: Int) {
        val t = text.trim().trimStart('\uFEFF').trim()
        if (t.isEmpty()) return
        if ((t.startsWith("{") || t.startsWith("[")) && ingestJson(t, ctx)) return
        if (depth < MAX_BASE64_DEPTH && Base64Codec.looksLikeBase64(t)) {
            val decoded = Base64Codec.decodeToString(t)
            if (decoded != null && decoded.isNotBlank()) {
                ingest(decoded, ctx, depth + 1)
                return
            }
        }
        ingestLines(t, ctx)
    }

    // ---- plain lines ---------------------------------------------------------------------------------------

    private fun ingestLines(text: String, ctx: Ctx) {
        for (raw in text.lineSequence()) {
            val line = raw.trim()
            if (line.isEmpty()) continue
            if (line.startsWith("#") || line.startsWith("//")) {
                ctx.meta.putInlineLine(line)
                continue
            }
            val routing = ROUTING_LINE.matchEntire(line)
            if (routing != null) {
                val kind = routing.groupValues[1].lowercase()
                val action = routing.groupValues[2].lowercase()
                ctx.routing.add(RoutingDirective(line, auto = kind == "autorouting", activate = kind == "onadd" || action == "onadd"))
                continue
            }
            if (ShareLinkParser.schemeOf(line) == null) {
                // Some panels put Base64 blobs or notices between the links; one bad line must not fail the import.
                ctx.skipped.add(SkippedEntry(preview(line), "Not a link"))
                continue
            }
            addLink(line, ctx)
        }
    }

    private fun addLink(line: String, ctx: Ctx) {
        when (val r = ShareLinkParser.parse(line, clock())) {
            is LinkParseResult.Ok -> {
                ctx.servers.add(r.profile)
                r.warnings.forEach { ctx.warnings.add("${r.profile.name}: $it") }
            }
            is LinkParseResult.Skipped -> ctx.skipped.add(SkippedEntry(preview(line), r.reason))
            is LinkParseResult.Invalid -> ctx.skipped.add(SkippedEntry(preview(line), r.reason))
            LinkParseResult.NotALink -> ctx.skipped.add(SkippedEntry(preview(line), "Not a proxy link"))
        }
    }

    // ---- JSON ----------------------------------------------------------------------------------------------

    private fun ingestJson(text: String, ctx: Ctx): Boolean {
        val element = runCatching { Json.parseToJsonElement(text) }.getOrNull() ?: return false
        when (element) {
            is JsonArray -> element.forEach { ingestJsonItem(it, ctx) }
            is JsonObject -> ingestJsonItem(element, ctx)
            else -> return false
        }
        return true
    }

    private fun ingestJsonItem(item: JsonElement, ctx: Ctx) {
        when (item) {
            is JsonPrimitive -> {
                val s = item.contentOrNull?.trim().orEmpty()
                if (s.isNotEmpty()) ingestLines(s, ctx)
            }
            is JsonObject -> ingestJsonObject(item, ctx)
            else -> ctx.skipped.add(SkippedEntry("JSON entry", "Unrecognised entry"))
        }
    }

    private fun ingestJsonObject(obj: JsonObject, ctx: Ctx) {
        val type = (obj["type"] as? JsonPrimitive)?.contentOrNull?.lowercase()
        if (type == "amneziawg" || type == "awg" || type == "wireguard") {
            ctx.skipped.add(SkippedEntry("AmneziaWG subscription", "WireGuard/AmneziaWG is not supported yet"))
            return
        }
        val remarks = (obj["remarks"] as? JsonPrimitive)?.contentOrNull?.trim()?.ifEmpty { null }
        val outbounds = (obj["outbounds"] as? JsonArray)?.filterIsInstance<JsonObject>()
        if (outbounds != null) {
            val proxies = outbounds.filter { protocolOf(it) in PROXY_PROTOCOLS }
            if (proxies.isEmpty()) {
                ctx.skipped.add(SkippedEntry(remarks ?: "Xray config", "The config has no proxy outbound"))
            }
            proxies.forEach { ob ->
                val tag = (ob["tag"] as? JsonPrimitive)?.contentOrNull?.trim()?.ifEmpty { null }
                val name = if (proxies.size == 1) remarks ?: tag else listOfNotNull(remarks, tag).joinToString(" \u00B7 ").ifEmpty { null }
                addOutbound(ob, name, ctx)
            }
            return
        }
        if (protocolOf(obj) in PROXY_PROTOCOLS) {
            addOutbound(obj, remarks ?: (obj["tag"] as? JsonPrimitive)?.contentOrNull, ctx)
            return
        }
        ctx.skipped.add(SkippedEntry(remarks ?: "JSON entry", "Neither an Xray config nor an outbound"))
    }

    private fun addOutbound(outbound: JsonObject, name: String?, ctx: Ctx) {
        val label = name ?: "outbound"
        if (outbound["proxySettings"] != null ||
            ((outbound["streamSettings"] as? JsonObject)?.get("sockopt") as? JsonObject)?.get("dialerProxy") != null
        ) {
            ctx.skipped.add(SkippedEntry(label, "Chained outbounds (proxy over proxy) are not supported"))
            return
        }
        when (val s = OutboundSanitizer.sanitize(outbound)) {
            is OutboundSanitizer.Result.Skip -> ctx.skipped.add(SkippedEntry(label, s.reason))
            is OutboundSanitizer.Result.Ok -> {
                val profile = ServerProfile.fromOutbound(s.outbound, name, clock())
                if (profile == null) {
                    ctx.skipped.add(SkippedEntry(label, "No readable server address"))
                } else {
                    ctx.servers.add(profile)
                    s.warnings.forEach { ctx.warnings.add("${profile.name}: $it") }
                }
            }
        }
    }

    private fun protocolOf(ob: JsonObject): String? = (ob["protocol"] as? JsonPrimitive)?.contentOrNull?.lowercase()

    private fun preview(line: String): String = if (line.length > 48) line.substring(0, 48) + "\u2026" else line

    private companion object {
        const val MAX_BASE64_DEPTH = 3
        val PROXY_PROTOCOLS = setOf("vless", "vmess", "trojan", "shadowsocks", "socks", "http", "wireguard")
        val ROUTING_LINE = Regex(
            "^(?:[A-Za-z][A-Za-z0-9+.\\-]*)?://(autorouting|routing|onadd)(?:/(add|onadd))?/(\\S+)$",
            RegexOption.IGNORE_CASE,
        )
    }
}

/**
 * Makes an Xray outbound taken from a provider config acceptable to the pinned Xray-core, which is
 * stricter than older versions: removed transports are skipped, `allowInsecure` is dropped, REALITY
 * gets a fingerprint, and VLESS/Trojan without any security to a public address is refused.
 */
internal object OutboundSanitizer {
    sealed interface Result {
        data class Ok(val outbound: JsonObject, val warnings: List<String>) : Result
        data class Skip(val reason: String) : Result
    }

    private val REMOVED_NETWORKS = setOf("h2", "http", "h3", "quic")

    fun sanitize(outbound: JsonObject): Result {
        val warnings = ArrayList<String>()
        val protocol = (outbound["protocol"] as? JsonPrimitive)?.contentOrNull?.lowercase().orEmpty()
        var result = JsonObject(outbound.filterKeys { it != "tag" && it != "sendThrough" })

        val stream = result["streamSettings"] as? JsonObject
        if (stream != null) {
            val network = (stream["network"] as? JsonPrimitive)?.contentOrNull?.lowercase()
            if (network != null && network in REMOVED_NETWORKS) {
                return Result.Skip("The '$network' transport was removed from Xray-core")
            }
            val security = (stream["security"] as? JsonPrimitive)?.contentOrNull?.lowercase()
            if (security == "xtls") return Result.Skip("XTLS security was removed from Xray-core")

            var newStream = stream
            val tls = stream["tlsSettings"] as? JsonObject
            if (tls != null && tls["allowInsecure"] != null) {
                newStream = JsonObject(newStream + ("tlsSettings" to JsonObject(tls.filterKeys { it != "allowInsecure" })))
                warnings.add("allowInsecure was removed; the certificate is still verified")
            }
            val reality = newStream["realitySettings"] as? JsonObject
            if (reality != null) {
                val fp = (reality["fingerprint"] as? JsonPrimitive)?.contentOrNull?.lowercase().orEmpty()
                if (fp.isEmpty() || fp == "unsafe" || fp == "hellogolang") {
                    newStream = JsonObject(newStream + ("realitySettings" to JsonObject(reality + ("fingerprint" to JsonPrimitive("chrome")))))
                }
            }
            result = JsonObject(result + ("streamSettings" to newStream))
        }

        if (protocol == "vless" || protocol == "trojan") {
            val security = ((result["streamSettings"] as? JsonObject)?.get("security") as? JsonPrimitive)?.contentOrNull.orEmpty()
            val settings = result["settings"] as? JsonObject
            val encryption = (settings?.get("encryption") as? JsonPrimitive)?.contentOrNull.orEmpty()
            val plainVless = protocol == "vless" && (encryption.isEmpty() || encryption == "none")
            if (security.isEmpty() || security == "none") {
                if (protocol == "trojan" || plainVless) {
                    val host = ServerProfile.fromOutbound(result, null)?.host
                    if (host != null && !Hosts.isPrivate(host)) {
                        return Result.Skip("Xray-core refuses ${protocol.uppercase()} without TLS/REALITY to a public address")
                    }
                }
            }
        }
        return Result.Ok(result, warnings)
    }
}
