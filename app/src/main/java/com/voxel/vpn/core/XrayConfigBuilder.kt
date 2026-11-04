package com.voxel.vpn.core

import com.voxel.vpn.dpi.DpiRoute
import com.voxel.vpn.model.ServerProfile
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject

/** Knobs of the generated core configuration. */
data class CoreOptions(
    val mtu: Int = 1500,
    /** Capture IPv6 and let the resolver answer AAAA queries. */
    val ipv6: Boolean = false,
    val logLevel: String = "warning",
    val remoteDns: List<String> = listOf("https://1.1.1.1/dns-query", "https://8.8.8.8/dns-query"),
    val sniffing: Boolean = true,
    /** Pre-resolved addresses of server host names, so the core never needs the platform resolver to reach the server. */
    val resolvedHosts: Map<String, List<String>> = emptyMap(),
    /** When set, the server connection is chained through the DPI engine's SOCKS5 proxy (if the transport allows it). */
    val dpi: DpiRoute? = null,
)

/**
 * Generates the Xray-core configuration on the fly for the selected server (Global mode):
 * a `tun` inbound fed with the VpnService descriptor, DNS through DoH over the proxy, private
 * networks direct, everything else through the proxy outbound.
 */
object XrayConfigBuilder {
    const val TAG_TUN = "tun"
    const val TAG_DNS_IN = "dns-in"
    const val TAG_PROXY = "proxy"
    const val TAG_DIRECT = "direct"
    const val TAG_BLOCK = "block"
    const val TAG_DNS_OUT = "dns-out"

    /** The SOCKS5 outbound that leads to the local DPI engine; the proxy outbound dials through it. */
    const val TAG_DPI = "dpi-out"
    const val TUN_NAME = "xray0"

    /** Destinations that never go through the proxy: LAN, loopback, link-local, multicast. */
    val DIRECT_CIDRS = listOf(
        "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8", "169.254.0.0/16",
        "224.0.0.0/4", "255.255.255.255/32", "fc00::/7", "fe80::/10", "ff00::/8",
    )

    fun build(server: ServerProfile, options: CoreOptions = CoreOptions()): String = buildJson(server, options).toString()

    fun buildJson(server: ServerProfile, options: CoreOptions = CoreOptions()): JsonObject = buildJsonObject {
        putJsonObject("log") {
            put("loglevel", options.logLevel)
            put("access", "none")
        }
        putJsonObject("stats") {}
        putJsonObject("policy") {
            putJsonObject("system") {
                put("statsInboundUplink", true)
                put("statsInboundDownlink", true)
                put("statsOutboundUplink", true)
                put("statsOutboundDownlink", true)
            }
        }
        putJsonObject("dns") {
            putJsonObject("hosts") {
                options.resolvedHosts.toSortedMap().forEach { (host, ips) ->
                    when (ips.size) {
                        0 -> Unit
                        1 -> put(host, ips.first())
                        else -> putJsonArray(host) { ips.forEach { add(it) } }
                    }
                }
            }
            putJsonArray("servers") { options.remoteDns.forEach { add(it) } }
            put("queryStrategy", if (options.ipv6) "UseIP" else "UseIPv4")
            put("tag", TAG_DNS_IN)
        }
        putJsonArray("inbounds") { add(tunInbound(options)) }
        putJsonArray("outbounds") {
            add(proxyOutbound(server, options.dpi))
            add(
                buildJsonObject {
                    put("tag", TAG_DIRECT)
                    put("protocol", "freedom")
                    putJsonObject("settings") { put("domainStrategy", "UseIP") }
                },
            )
            add(
                buildJsonObject {
                    put("tag", TAG_BLOCK)
                    put("protocol", "blackhole")
                },
            )
            add(
                buildJsonObject {
                    put("tag", TAG_DNS_OUT)
                    put("protocol", "dns")
                },
            )
            if (options.dpi != null && supportsDpi(server)) add(dpiOutbound(options.dpi))
        }
        putJsonObject("routing") {
            put("domainStrategy", "AsIs")
            putJsonArray("rules") {
                // The resolver's own queries (DoH) must leave through the proxy, never loop back into the DNS outbound.
                add(rule(outbound = TAG_PROXY) { putJsonArray("inboundTag") { add(TAG_DNS_IN) } })
                add(
                    rule(outbound = TAG_DNS_OUT) {
                        putJsonArray("inboundTag") { add(TAG_TUN) }
                        put("port", "53")
                    },
                )
                add(rule(outbound = TAG_DIRECT) { putJsonArray("ip") { DIRECT_CIDRS.forEach { add(it) } } })
                add(rule(outbound = TAG_PROXY) { put("network", "tcp,udp") })
            }
        }
    }

    /**
     * The server outbound with our tag and a socket-level resolver strategy so domain addresses use the core's DNS.
     * With a [dpi] route (and a transport that runs over TCP) the connection is dialled through the DPI engine.
     */
    internal fun proxyOutbound(server: ServerProfile, dpi: DpiRoute? = null): JsonObject {
        val outbound = server.outbound
        val stream = outbound["streamSettings"] as? JsonObject ?: JsonObject(emptyMap())
        val sockopt = stream["sockopt"] as? JsonObject ?: JsonObject(emptyMap())
        var newSockopt = if ("domainStrategy" in sockopt) sockopt else JsonObject(sockopt + ("domainStrategy" to JsonPrimitive("UseIP")))
        if (dpi != null && supportsDpi(outbound)) newSockopt = JsonObject(newSockopt + ("dialerProxy" to JsonPrimitive(TAG_DPI)))
        val newStream = JsonObject(stream + ("sockopt" to newSockopt))
        return JsonObject(outbound + mapOf<String, JsonElement>("tag" to JsonPrimitive(TAG_PROXY), "streamSettings" to newStream))
    }

    /** The SOCKS5 client that talks to the engine on loopback, with the per-session credentials. */
    internal fun dpiOutbound(route: DpiRoute): JsonObject = buildJsonObject {
        put("tag", TAG_DPI)
        put("protocol", "socks")
        putJsonObject("settings") {
            put("address", "127.0.0.1")
            put("port", route.port)
            put("user", route.user)
            put("pass", route.pass)
        }
    }

    /** Transports that open an ordinary TCP connection to the server: the only ones the DPI engine can reshape. */
    private val TCP_TRANSPORTS = setOf("tcp", "raw", "ws", "httpupgrade", "grpc", "xhttp", "splithttp")

    /** Protocols that talk UDP (QUIC) or have no server connection of their own. */
    private val NON_TCP_PROTOCOLS = setOf("hysteria", "wireguard", "freedom", "blackhole", "dns", "loopback")

    fun supportsDpi(server: ServerProfile): Boolean = supportsDpi(server.outbound)

    internal fun supportsDpi(outbound: JsonObject): Boolean {
        val protocol = (outbound["protocol"] as? JsonPrimitive)?.contentOrNull?.lowercase() ?: return false
        if (protocol in NON_TCP_PROTOCOLS) return false
        val stream = outbound["streamSettings"] as? JsonObject
        val network = (stream?.get("network") as? JsonPrimitive)?.contentOrNull?.lowercase() ?: "tcp"
        if (network !in TCP_TRANSPORTS) return false
        // XHTTP can run over HTTP/3, which is QUIC on UDP.
        val alpn = (stream?.get("tlsSettings") as? JsonObject)?.get("alpn") as? JsonArray
        if (alpn != null && alpn.any { (it as? JsonPrimitive)?.contentOrNull.equals("h3", ignoreCase = true) }) return false
        return true
    }

    private fun tunInbound(options: CoreOptions): JsonObject = buildJsonObject {
        put("tag", TAG_TUN)
        put("protocol", "tun")
        putJsonObject("settings") {
            put("name", TUN_NAME)
            put("mtu", options.mtu)
        }
        if (options.sniffing) {
            putJsonObject("sniffing") {
                put("enabled", true)
                putJsonArray("destOverride") {
                    add("http")
                    add("tls")
                    add("quic")
                }
                put("routeOnly", true)
            }
        }
    }

    private fun rule(outbound: String, fill: kotlinx.serialization.json.JsonObjectBuilder.() -> Unit): JsonObject = buildJsonObject {
        put("type", "field")
        fill()
        put("outboundTag", outbound)
    }

    /** Hosts that need pre-resolving: the proxy server's address when it is a domain name. */
    fun hostsToResolve(server: ServerProfile): List<String> {
        val host = server.host
        val isIp = host.contains(':') || Regex("^(?:\\d{1,3}\\.){3}\\d{1,3}$").matches(host)
        return if (isIp || host.isEmpty()) emptyList() else listOf(host)
    }
}
