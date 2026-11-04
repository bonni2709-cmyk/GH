package com.voxel.vpn.core

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.atomic.AtomicLong

enum class LogLevel { DEBUG, INFO, WARN, ERROR }

data class LogLine(
    val id: Long,
    val timeMs: Long,
    val level: LogLevel,
    val tag: String,
    val text: String,
)

/** In-memory ring buffer with the most recent log lines of the app and of the Xray core. */
class LogBus(
    private val capacity: Int = 500,
    private val clock: () -> Long = System::currentTimeMillis,
) {
    private val counter = AtomicLong()
    private val state = MutableStateFlow<List<LogLine>>(emptyList())

    val lines: StateFlow<List<LogLine>> = state.asStateFlow()

    fun log(level: LogLevel, tag: String, text: String) {
        val clean = text.trim()
        if (clean.isEmpty()) return
        val line = LogLine(counter.incrementAndGet(), clock(), level, tag, clean.take(MAX_LINE_LENGTH))
        state.update { old ->
            if (old.size >= capacity) old.subList(old.size - capacity + 1, old.size) + line else old + line
        }
    }

    fun debug(tag: String, text: String) = log(LogLevel.DEBUG, tag, text)

    fun info(tag: String, text: String) = log(LogLevel.INFO, tag, text)

    fun warn(tag: String, text: String) = log(LogLevel.WARN, tag, text)

    fun error(tag: String, text: String) = log(LogLevel.ERROR, tag, text)

    /** Takes a raw Xray log line such as `2026/11/04 10:00:00 [Warning] app/dns: ...`. */
    fun core(raw: String?) {
        if (raw.isNullOrBlank()) return
        var text = raw.trim().replace(CORE_TIMESTAMP, "")
        var level = LogLevel.INFO
        val marker = CORE_LEVEL.find(text)
        if (marker != null) {
            level = when (marker.groupValues[1]) {
                "Debug" -> LogLevel.DEBUG
                "Warning" -> LogLevel.WARN
                "Error" -> LogLevel.ERROR
                else -> LogLevel.INFO
            }
            text = text.substring(marker.range.last + 1)
        }
        log(level, "xray", text)
    }

    fun clear() {
        state.value = emptyList()
    }

    /** The whole buffer as plain text, for sharing. */
    fun dump(): String {
        val format = SimpleDateFormat("HH:mm:ss", Locale.ROOT)
        return state.value.joinToString("\n") { line ->
            "${format.format(Date(line.timeMs))} ${line.level.name.first()} ${line.tag}: ${line.text}"
        }
    }

    private companion object {
        const val MAX_LINE_LENGTH = 2000
        val CORE_TIMESTAMP = Regex("""^\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?\s*""")
        val CORE_LEVEL = Regex("""^\[(Debug|Info|Warning|Error)]\s*""")
    }
}
