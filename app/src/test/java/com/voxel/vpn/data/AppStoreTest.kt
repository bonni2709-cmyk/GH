package com.voxel.vpn.data

import com.voxel.vpn.model.AppData
import com.voxel.vpn.model.ServerProfile
import com.voxel.vpn.model.SubscriptionMeta
import com.voxel.vpn.parser.incy.ImportedSource
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

class AppStoreTest {
    private fun withTempDir(block: (File) -> Unit) {
        val dir = Files.createTempDirectory("voxel-store").toFile()
        try {
            block(dir)
        } finally {
            dir.deleteRecursively()
        }
    }

    private fun sample(): ImportedSource {
        val server = ServerProfile.fromOutbound(
            buildJsonObject {
                put("protocol", "trojan")
                putJsonObject("settings") {
                    put("address", "t.example.com")
                    put("port", 443)
                    put("password", "secret")
                }
            },
            "Trojan",
        )!!
        return ImportedSource("Sub", "https://sub.example.com/x", "incy:add", listOf(server), SubscriptionMeta(title = "Sub"), emptyList(), emptyList(), emptyList())
    }

    @Test
    fun dataSurvivesARestart() = withTempDir { dir ->
        val file = File(dir, "nested/voxel-data.json")
        val store = AppStore(file)
        assertEquals(AppData(), store.data.value)
        val merged = runBlocking { store.update { it.withSource(sample(), now = 42).data } }

        assertTrue(file.isFile)
        assertFalse(File(dir, "nested/voxel-data.json.tmp").exists())
        val reloaded = AppStore(file).data.value
        assertEquals(merged, reloaded)
        assertEquals("Trojan", reloaded.servers.single().name)
        assertEquals(reloaded.servers.single().id, reloaded.settings.selectedServerId)
    }

    @Test
    fun anUnchangedUpdateWritesNothing() = withTempDir { dir ->
        val file = File(dir, "voxel-data.json")
        val store = AppStore(file)
        runBlocking { store.update { it } }
        assertFalse(file.exists())
    }

    @Test
    fun aCorruptFileIsSetAsideAndTheStoreStartsEmpty() = withTempDir { dir ->
        val file = File(dir, "voxel-data.json")
        file.writeText("{ this is not json")
        val store = AppStore(file)
        assertEquals(AppData(), store.data.value)
        assertTrue(File(dir, "voxel-data.json.corrupt").isFile)
        runBlocking { store.update { it.withSource(sample(), now = 1).data } }
        assertEquals(1, AppStore(file).data.value.servers.size)
    }

    @Test
    fun unknownFieldsFromNewerVersionsAreIgnored() = withTempDir { dir ->
        val file = File(dir, "voxel-data.json")
        file.writeText("""{"subscriptions":[],"servers":[],"settings":{"ipv6":true,"futureFlag":1},"extra":[1,2]}""")
        val data = AppStore(file).data.value
        assertTrue(data.settings.ipv6)
    }

    @Test
    fun concurrentUpdatesAreSerialisedAndNoneIsLost() = withTempDir { dir ->
        val file = File(dir, "voxel-data.json")
        val store = AppStore(file)
        runBlocking {
            (1..20).map {
                async(Dispatchers.Default) {
                    // logLevel doubles as a counter here: a lost update would leave it below 20.
                    store.update { data -> data.withSettings { it.copy(logLevel = ((it.logLevel.toIntOrNull() ?: 0) + 1).toString()) } }
                }
            }.awaitAll()
        }
        assertEquals("20", store.data.value.settings.logLevel)
        assertEquals("20", AppStore(file).data.value.settings.logLevel)
    }
}
