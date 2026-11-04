package com.voxel.vpn.ui

import java.util.Locale

/** Number formatting used by the screens. Pure functions, so they can be unit-tested. */
object Format {
    private val UNITS = arrayOf("B", "KB", "MB", "GB", "TB")

    fun bytes(value: Long): String {
        if (value <= 0) return "0 B"
        var scaled = value.toDouble()
        var unit = 0
        while (scaled >= 1024.0 && unit < UNITS.lastIndex) {
            scaled /= 1024.0
            unit++
        }
        if (unit == 0) return "$value B"
        val decimals = if (scaled < 10) 2 else if (scaled < 100) 1 else 0
        return String.format(Locale.ROOT, "%.${decimals}f %s", scaled, UNITS[unit])
    }

    fun speed(bytesPerSecond: Long): String = bytes(bytesPerSecond) + "/s"

    /** `mm:ss`, or `h:mm:ss` from one hour on. */
    fun duration(millis: Long): String {
        val total = if (millis < 0) 0 else millis / 1000
        val hours = total / 3600
        val minutes = total % 3600 / 60
        val seconds = total % 60
        return if (hours > 0) {
            String.format(Locale.ROOT, "%d:%02d:%02d", hours, minutes, seconds)
        } else {
            String.format(Locale.ROOT, "%02d:%02d", minutes, seconds)
        }
    }

    /** Whole days until [expireAtSeconds] (rounded up); negative once it is in the past. */
    fun daysLeft(expireAtSeconds: Long, nowSeconds: Long): Long {
        val remaining = expireAtSeconds - nowSeconds
        return if (remaining >= 0) (remaining + 86_399) / 86_400 else -((-remaining + 86_399) / 86_400)
    }

    /** Used share of [total] in percent, clamped to 0..100; 0 when there is no limit. */
    fun percent(used: Long, total: Long): Int {
        if (total <= 0) return 0
        val value = used.toDouble() / total.toDouble() * 100.0
        return value.coerceIn(0.0, 100.0).toInt()
    }
}
