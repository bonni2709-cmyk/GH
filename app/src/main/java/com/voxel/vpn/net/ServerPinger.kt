package com.voxel.vpn.net

import com.voxel.vpn.model.ServerProfile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Socket

/** Result of a reachability probe. [ms] is null when the server did not answer. */
data class PingResult(val ms: Int?, val error: String? = null) {
    val reachable: Boolean get() = ms != null

    companion object {
        val NOT_APPLICABLE = PingResult(null, "n/a")
    }
}

/**
 * Measures how long a TCP connection to a server takes. That is the cost of one network round
 * trip to the server and works for every TCP-based protocol; UDP-only servers report [PingResult.NOT_APPLICABLE].
 */
class ServerPinger(
    private val timeoutMs: Int = 3_000,
    private val concurrency: Int = 12,
    private val attempts: Int = 2,
    private val resolver: HostResolver = SystemHostResolver(),
) {
    /** Pings all [servers] concurrently; [onResult] is called as soon as each server is done. */
    suspend fun ping(
        servers: List<ServerProfile>,
        ipv6: Boolean = false,
        onResult: (serverId: String, result: PingResult) -> Unit = { _, _ -> },
    ): Map<String, PingResult> = coroutineScope {
        val gate = Semaphore(concurrency)
        servers.map { server ->
            async {
                gate.withPermit {
                    val result = pingOne(server, ipv6)
                    onResult(server.id, result)
                    server.id to result
                }
            }
        }.awaitAll().toMap()
    }

    suspend fun pingOne(server: ServerProfile, ipv6: Boolean = false): PingResult {
        if (!server.tcpProbeable) return PingResult.NOT_APPLICABLE
        val address = if (isIpLiteral(server.host)) {
            server.host
        } else {
            resolver.resolve(server.host, ipv6).firstOrNull() ?: return PingResult(null, "DNS lookup failed")
        }
        return withContext(Dispatchers.IO) {
            var best: Int? = null
            var lastError: String? = null
            repeat(attempts) {
                try {
                    val started = System.nanoTime()
                    Socket().use { socket ->
                        socket.tcpNoDelay = true
                        socket.connect(InetSocketAddress(address, server.port), timeoutMs)
                    }
                    val elapsed = ((System.nanoTime() - started) / 1_000_000L).toInt().coerceAtLeast(1)
                    best = minOf(best ?: Int.MAX_VALUE, elapsed)
                } catch (e: IOException) {
                    lastError = e.message ?: e.javaClass.simpleName
                }
            }
            best?.let { PingResult(it) } ?: PingResult(null, lastError ?: "unreachable")
        }
    }

    private fun isIpLiteral(host: String): Boolean = host.contains(':') || IPV4.matches(host)

    private companion object {
        val IPV4 = Regex("^(?:\\d{1,3}\\.){3}\\d{1,3}$")
    }
}
