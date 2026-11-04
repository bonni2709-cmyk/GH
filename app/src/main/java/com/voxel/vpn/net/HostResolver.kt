package com.voxel.vpn.net

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import java.net.HttpURLConnection
import java.net.Inet4Address
import java.net.Inet6Address
import java.net.InetAddress
import java.net.URL
import java.net.URLEncoder

/** Resolves a server host name to IP literals. Never throws; an empty list means "could not resolve". */
interface HostResolver {
    suspend fun resolve(host: String, ipv6: Boolean = false): List<String>
}

/**
 * The platform resolver, bounded by a timeout. A blocking lookup cannot be interrupted, so it runs in a
 * detached scope: on timeout the caller moves on and the lookup is simply abandoned.
 */
class SystemHostResolver(private val timeoutMs: Long = 4_000) : HostResolver {
    private val detached = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override suspend fun resolve(host: String, ipv6: Boolean): List<String> {
        val lookup = detached.async {
            try {
                InetAddress.getAllByName(host).mapNotNull { address ->
                    when (address) {
                        is Inet4Address -> address.hostAddress
                        is Inet6Address -> if (ipv6) address.hostAddress?.substringBefore('%') else null
                        else -> null
                    }
                }
            } catch (_: java.io.IOException) {
                emptyList()
            }
        }
        return withTimeoutOrNull(timeoutMs) { lookup.await() } ?: emptyList()
    }
}

/**
 * DNS-over-HTTPS (JSON API) against public resolvers addressed by IP, so it works when the system
 * resolver is poisoned or blocked. The connection is made by this process, outside the VPN.
 */
class DohHostResolver(
    private val endpoints: List<String> = listOf("https://1.1.1.1/dns-query", "https://8.8.8.8/resolve"),
    private val timeoutMs: Int = 4_000,
) : HostResolver {
    override suspend fun resolve(host: String, ipv6: Boolean): List<String> = withContext(Dispatchers.IO) {
        val found = LinkedHashSet<String>()
        val types = if (ipv6) listOf(1 to "A", 28 to "AAAA") else listOf(1 to "A")
        for (endpoint in endpoints) {
            for ((code, name) in types) {
                found.addAll(query(endpoint, host, code, name))
            }
            if (found.isNotEmpty()) break
        }
        found.toList()
    }

    private fun query(endpoint: String, host: String, typeCode: Int, typeName: String): List<String> {
        return try {
            val url = URL("$endpoint?name=${URLEncoder.encode(host, "UTF-8")}&type=$typeName")
            val connection = url.openConnection() as HttpURLConnection
            try {
                connection.connectTimeout = timeoutMs
                connection.readTimeout = timeoutMs
                connection.setRequestProperty("Accept", "application/dns-json")
                if (connection.responseCode != 200) return emptyList()
                val text = connection.inputStream.use { String(it.readBytes(), Charsets.UTF_8) }
                parseAnswers(text, typeCode)
            } finally {
                connection.disconnect()
            }
        } catch (_: java.io.IOException) {
            emptyList()
        } catch (_: IllegalArgumentException) {
            emptyList()
        }
    }

    internal companion object {
        fun parseAnswers(json: String, typeCode: Int): List<String> {
            val root = runCatching { Json.parseToJsonElement(json) }.getOrNull() as? JsonObject ?: return emptyList()
            val answers = root["Answer"] as? JsonArray ?: return emptyList()
            return answers.mapNotNull { entry ->
                val obj = entry as? JsonObject ?: return@mapNotNull null
                val type = (obj["type"] as? JsonPrimitive)?.intOrNull
                val data = (obj["data"] as? JsonPrimitive)?.contentOrNull
                if (type == typeCode && !data.isNullOrBlank()) data.trim() else null
            }
        }
    }
}

/** Tries each resolver in turn and returns the first non-empty answer. */
class ChainHostResolver(private val resolvers: List<HostResolver>) : HostResolver {
    constructor(vararg resolvers: HostResolver) : this(resolvers.toList())

    override suspend fun resolve(host: String, ipv6: Boolean): List<String> {
        for (resolver in resolvers) {
            val result = resolver.resolve(host, ipv6)
            if (result.isNotEmpty()) return result
        }
        return emptyList()
    }
}
