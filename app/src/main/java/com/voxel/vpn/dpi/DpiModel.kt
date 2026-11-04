package com.voxel.vpn.dpi

import com.voxel.vpn.core.LogLevel
import com.voxel.vpn.model.AppSettings

/** The levels of DPI bypass the app offers. The ids of the presets are the preset names of the native engine. */
enum class DpiMode(val id: String) {
    OFF("off"),
    LIGHT("light"),
    STANDARD("standard"),
    STRONG("strong"),
    CUSTOM("custom"),
    ;

    companion object {
        fun fromId(id: String?): DpiMode = entries.firstOrNull { it.id == id } ?: OFF
    }
}

/** What the user chose, resolved to the strategy text that the native engine parses. */
data class DpiConfig(val mode: DpiMode = DpiMode.OFF, val custom: String = "") {
    /** The text handed to the engine; empty when there is nothing to do. */
    val strategy: String
        get() = when (mode) {
            DpiMode.OFF -> ""
            DpiMode.CUSTOM -> custom.trim()
            else -> mode.id
        }

    val enabled: Boolean get() = strategy.isNotEmpty()

    companion object {
        fun of(settings: AppSettings): DpiConfig = DpiConfig(DpiMode.fromId(settings.dpiMode), settings.dpiCustom)
    }
}

/** The local SOCKS5 proxy of the engine, which the proxy outbound of the core is chained through. */
data class DpiRoute(val port: Int, val user: String, val pass: String) {
    init {
        require(port in 1..65535) { "Invalid DPI proxy port $port" }
        require(user.isNotEmpty() && pass.isNotEmpty()) { "The DPI proxy needs credentials" }
    }
}

/** Counters of the engine for the current session. */
data class DpiStats(
    val accepted: Long = 0,
    val active: Long = 0,
    val connected: Long = 0,
    val desynced: Long = 0,
    val failed: Long = 0,
    val bytesUp: Long = 0,
    val bytesDown: Long = 0,
) {
    companion object {
        /** The engine's `[accepted, active, connected, desynced, failed, bytesUp, bytesDown]`. */
        fun from(values: LongArray?): DpiStats =
            if (values == null || values.size < 7) {
                DpiStats()
            } else {
                DpiStats(values[0], values[1], values[2], values[3], values[4], values[5], values[6])
            }
    }
}

data class DpiLogLine(val level: LogLevel, val text: String)

class DpiException(message: String) : Exception(message)

sealed interface DpiCheck {
    /** The strategy is valid; [canonical] is its normalised text. */
    data class Valid(val canonical: String) : DpiCheck

    data class Invalid(val reason: String) : DpiCheck
}

/** The text protocol of the JNI functions, kept apart from the native calls so it can be tested without a device. */
object DpiProtocol {
    /** `OK:<port>` gives the port, `ERR:<message>` throws. */
    fun parseStart(reply: String): Int {
        if (reply.startsWith("OK:")) {
            val port = reply.substring(3).trim().toIntOrNull()
            if (port != null && port in 1..65535) return port
            throw DpiException("The engine reported a bad port: $reply")
        }
        if (reply.startsWith("ERR:")) throw DpiException(reply.substring(4).trim().ifEmpty { "unknown error" })
        throw DpiException("Unexpected reply from the engine: ${reply.take(80)}")
    }

    fun parseCheck(reply: String): DpiCheck = when {
        reply.startsWith("OK:") -> DpiCheck.Valid(reply.substring(3).trim())
        reply.startsWith("ERR:") -> DpiCheck.Invalid(reply.substring(4).trim())
        else -> DpiCheck.Invalid(reply.take(80))
    }

    /** `name=ip,ip;name=ip`: the host names the engine resolves itself. Names or addresses with separators are skipped. */
    fun hostsParam(hosts: Map<String, List<String>>): String =
        hosts.toSortedMap().entries.mapNotNull { (name, addresses) ->
            val clean = addresses.filter { it.isNotBlank() && it.none { c -> c == ',' || c == ';' || c == '=' || c.isWhitespace() } }
            if (name.isBlank() || name.any { it == '=' || it == ';' || it.isWhitespace() } || clean.isEmpty()) null else "$name=${clean.joinToString(",")}"
        }.joinToString(";")

    /** Lines of the form `W|text`, as drained from the engine's ring buffer. */
    fun parseLog(text: String): List<DpiLogLine> = text.lineSequence().mapNotNull { line ->
        if (line.length < 3 || line[1] != '|') return@mapNotNull null
        val level = when (line[0]) {
            'D' -> LogLevel.DEBUG
            'I' -> LogLevel.INFO
            'W' -> LogLevel.WARN
            'E' -> LogLevel.ERROR
            else -> return@mapNotNull null
        }
        DpiLogLine(level, line.substring(2))
    }.toList()
}
