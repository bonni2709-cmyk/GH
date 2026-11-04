package com.voxel.vpn.vpn

import com.voxel.vpn.core.LogBus
import com.voxel.vpn.dpi.DpiCheck
import com.voxel.vpn.dpi.DpiException
import com.voxel.vpn.dpi.DpiProtocol
import com.voxel.vpn.dpi.DpiRoute
import com.voxel.vpn.dpi.DpiStats
import java.security.SecureRandom

/**
 * The Kotlin face of `libvoxeldpi.so` (app/src/main/cpp): a SOCKS5 proxy on 127.0.0.1 that cuts up the first
 * payload of every connection (TCP segments, TLS records, urgent byte, TTL tricks) before it reaches the network.
 * Xray-core reaches the VPN server through it (`sockopt.dialerProxy`), so the server's TLS hello is what gets cut.
 */
object DpiEngine {
    @Volatile
    private var loaded: Boolean? = null

    /** False when the native library cannot be loaded (an unsupported CPU, for instance). */
    fun isAvailable(): Boolean {
        loaded?.let { return it }
        return synchronized(this) {
            val known = loaded
            if (known != null) {
                known
            } else {
                val ok = try {
                    System.loadLibrary("voxeldpi")
                    true
                } catch (e: UnsatisfiedLinkError) {
                    false
                }
                loaded = ok
                ok
            }
        }
    }

    /**
     * Starts the proxy with [strategy] (see the README for the syntax) and returns how to reach it. [hosts] are
     * names the proxy resolves itself, before it asks the system resolver. A running engine is restarted.
     */
    fun start(strategy: String, hosts: Map<String, List<String>> = emptyMap()): DpiRoute {
        if (!isAvailable()) throw DpiException("The DPI library cannot be loaded on this device")
        val random = SecureRandom()
        val user = randomToken(random)
        val pass = randomToken(random)
        val port = DpiProtocol.parseStart(nativeStart(strategy, user, pass, DpiProtocol.hostsParam(hosts)))
        return DpiRoute(port, user, pass)
    }

    fun stop() {
        if (loaded == true) nativeStop()
    }

    fun stats(): DpiStats = if (loaded == true) DpiStats.from(nativeStats()) else DpiStats()

    /** Copies what the engine logged since the last call into [logs]. */
    fun drainLog(logs: LogBus) {
        if (loaded != true) return
        for (line in DpiProtocol.parseLog(nativeDrainLog())) logs.log(line.level, "dpi", line.text)
    }

    /** Whether [strategy] parses; null when the library is not available to ask. */
    fun check(strategy: String): DpiCheck? = if (isAvailable()) DpiProtocol.parseCheck(nativeCheck(strategy)) else null

    /** Whether decoy segments (`fake`) can work on this kernel; false when the library is missing. */
    fun supportsFake(): Boolean = isAvailable() && nativeInfo().contains("fake=1")

    fun version(): String = if (isAvailable()) nativeInfo().substringAfter("version=").substringBefore(';') else "n/a"

    fun setDebug(enabled: Boolean) {
        if (isAvailable()) nativeSetDebug(enabled)
    }

    private fun randomToken(random: SecureRandom): String {
        val bytes = ByteArray(12)
        random.nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(it.toInt() and 0xFF) }
    }

    private external fun nativeStart(strategy: String, user: String, pass: String, hosts: String): String

    private external fun nativeStop()

    private external fun nativeStats(): LongArray

    private external fun nativeDrainLog(): String

    private external fun nativeCheck(strategy: String): String

    private external fun nativeInfo(): String

    private external fun nativeSetDebug(enabled: Boolean)
}
