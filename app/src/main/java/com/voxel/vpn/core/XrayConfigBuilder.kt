package com.voxel.vpn.core

import com.voxel.vpn.model.ServerProfile
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonObject
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
            add(proxyOutbound(server))
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

    /** The server outbound with our tag and a socket-level resolver strategy so domain addresses use the core's DNS. */
    internal fun proxyOutbound(server: ServerProfile): JsonObject {
        val outbound = server.outbound
        val stream = outbound["streamSettings"] as? JsonObject ?: JsonObject(emptyMap())
        val sockopt = stream["sockopt"] as? JsonObject ?: JsonObject(emptyMap())
        val newSockopt = if ("domainStrategy" in sockopt) sockopt else JsonObject(sockopt + ("domainStrategy" to JsonPrimitive("UseIP")))
        val newStream = JsonObject(stream + ("sockopt" to newSockopt))
        return JsonObject(outbound + mapOf<String, JsonElement>("tag" to JsonPrimitive(TAG_PROXY), "streamSettings" to newStream))
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
