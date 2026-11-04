package com.voxel.vpn.data

import com.voxel.vpn.model.AppData
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.io.File
import java.io.IOException

/**
 * Persists [AppData] as one JSON file. Writes go to a temporary file first and are then renamed over
 * the real one, so a crash can never leave a half-written file behind.
 */
class AppStore(private val file: File) {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }
    private val lock = Mutex()
    private val state = MutableStateFlow(load())

    val data: StateFlow<AppData> = state.asStateFlow()

    /** Applies [transform] to the current data, saves the result and publishes it. */
    suspend fun update(transform: (AppData) -> AppData): AppData = withContext(Dispatchers.IO) {
        lock.withLock {
            val current = state.value
            val next = transform(current)
            if (next != current) {
                write(next)
                state.value = next
            }
            next
        }
    }

    private fun load(): AppData {
        if (!file.isFile) return AppData()
        return try {
            json.decodeFromString(AppData.serializer(), file.readText())
        } catch (e: Exception) {
            // Keep the unreadable file for inspection and start clean instead of crashing on every launch.
            file.renameTo(File(file.parentFile, file.name + ".corrupt"))
            AppData()
        }
    }

    private fun write(data: AppData) {
        val parent = file.absoluteFile.parentFile
        if (parent != null && !parent.isDirectory && !parent.mkdirs()) throw IOException("Cannot create ${parent.path}")
        val temp = File(parent, file.name + ".tmp")
        temp.writeText(json.encodeToString(AppData.serializer(), data))
        if (!temp.renameTo(file)) {
            if (file.exists() && !file.delete()) throw IOException("Cannot replace ${file.path}")
            if (!temp.renameTo(file)) throw IOException("Cannot move ${temp.path} to ${file.path}")
        }
    }
}
