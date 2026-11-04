package com.voxel.vpn.data

import com.voxel.vpn.model.AppData
import com.voxel.vpn.model.ServerProfile
import com.voxel.vpn.model.SubscriptionMeta
import com.voxel.vpn.parser.incy.ImportedSource
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AppDataOpsTest {
    private fun server(host: String, name: String = host) = ServerProfile.fromOutbound(
        buildJsonObject {
            put("protocol", "vless")
            putJsonObject("settings") {
                put("address", host)
                put("port", 443)
                put("id", "11111111-2222-3333-4444-555555555555")
                put("encryption", "none")
            }
        },
        name,
    )!!

    private fun source(url: String?, vararg servers: ServerProfile, title: String = "T", origin: String = "incy:add") =
        ImportedSource(title, url, origin, servers.toList(), SubscriptionMeta(), emptyList(), emptyList(), emptyList())

    @Test
    fun firstImportStoresTheGroupAndSelectsItsFirstServer() {
        val merge = AppData().withSource(source("https://sub.example.com/a", server("a1.example.com"), server("a2.example.com")), now = 100)
        assertEquals(2, merge.newServers)
        assertFalse(merge.refreshed)
        assertEquals(1, merge.data.subscriptions.size)
        assertEquals(2, merge.data.servers.size)
        assertEquals(merge.data.servers.first().id, merge.data.settings.selectedServerId)
        assertTrue(merge.data.servers.all { it.subscriptionId == merge.subscription.id && it.addedAt == 100L })
        assertEquals("https://sub.example.com/a", merge.subscription.url)
    }

    @Test
    fun reimportingTheSameUrlReplacesServersAndKeepsSelectionAndOrigin() {
        val url = "https://sub.example.com/a"
        val first = AppData().withSource(source(url, server("a1.example.com"), server("a2.example.com")), now = 100)
        val keep = first.data.servers[1].id
        val selected = first.data.withSelection(keep)

        val again = selected.withSource(source(url, server("a2.example.com"), server("a3.example.com"), origin = "refresh"), now = 200)
        assertTrue(again.refreshed)
        assertEquals(1, again.newServers)
        assertEquals(1, again.data.subscriptions.size)
        assertEquals("incy:add", again.subscription.origin)
        assertEquals(listOf("a2.example.com", "a3.example.com"), again.data.servers.map { it.host })
        assertEquals(keep, again.data.settings.selectedServerId)
        // The surviving server keeps its original timestamp, the new one gets the new one.
        assertEquals(listOf(100L, 200L), again.data.servers.map { it.addedAt })
        assertEquals(200L, again.subscription.updatedAt)
    }

    @Test
    fun selectionFallsBackWhenTheSelectedServerDisappears() {
        val url = "https://sub.example.com/a"
        val first = AppData().withSource(source(url, server("a1.example.com")), now = 1)
        val second = first.data.withSource(source(url, server("b1.example.com"), server("b2.example.com")), now = 2)
        assertEquals(second.data.servers.first().id, second.data.settings.selectedServerId)
    }

    @Test
    fun identicalServersOfTwoSubscriptionsStayDistinct() {
        val one = AppData().withSource(source("https://one.example.com/s", server("same.example.com")), now = 1)
        val two = one.data.withSource(source("https://two.example.com/s", server("same.example.com")), now = 2)
        assertEquals(2, two.data.servers.size)
        assertNotEquals(two.data.servers[0].id, two.data.servers[1].id)
        assertEquals(one.data.servers.first().id, two.data.settings.selectedServerId)
    }

    @Test
    fun literalLinksAccumulateInOneLocalGroup() {
        val a = AppData().withSource(source(null, server("l1.example.com"), title = "First"), now = 1)
        val b = a.data.withSource(source(null, server("l2.example.com"), server("l1.example.com"), title = "Second"), now = 2)
        assertEquals(1, b.data.subscriptions.size)
        assertEquals(LOCAL_SUBSCRIPTION_ID, b.data.subscriptions.single().id)
        assertEquals("First", b.data.subscriptions.single().title)
        assertEquals(setOf("l1.example.com", "l2.example.com"), b.data.servers.map { it.host }.toSet())
        assertEquals(2, b.data.servers.size)
        assertEquals(1, b.newServers)
        assertNull(b.data.subscriptions.single().url)
    }

    @Test
    fun removingASubscriptionDropsItsServersAndFixesTheSelection() {
        val one = AppData().withSource(source("https://one.example.com/s", server("o1.example.com")), now = 1)
        val two = one.data.withSource(source("https://two.example.com/s", server("t1.example.com")), now = 2)
        val removed = two.data.withoutSubscription(one.subscription.id)
        assertEquals(listOf("t1.example.com"), removed.servers.map { it.host })
        assertEquals(removed.servers.single().id, removed.settings.selectedServerId)
        val empty = removed.withoutSubscription(two.subscription.id)
        assertTrue(empty.servers.isEmpty() && empty.subscriptions.isEmpty())
        assertNull(empty.settings.selectedServerId)
    }

    @Test
    fun removingTheLastLocalServerRemovesTheLocalGroup() {
        val a = AppData().withSource(source(null, server("l1.example.com"), server("l2.example.com")), now = 1).data
        val afterFirst = a.withoutServer(a.servers[0].id)
        assertEquals(1, afterFirst.servers.size)
        assertEquals(1, afterFirst.subscriptions.size)
        assertEquals(afterFirst.servers.single().id, afterFirst.settings.selectedServerId)
        val afterSecond = afterFirst.withoutServer(afterFirst.servers[0].id)
        assertTrue(afterSecond.subscriptions.isEmpty())
        assertNull(afterSecond.settings.selectedServerId)
        assertEquals(afterSecond, afterSecond.withoutServer("missing"))
    }

    @Test
    fun selectingAnUnknownServerChangesNothing() {
        val data = AppData().withSource(source("https://sub.example.com/a", server("a1.example.com")), now = 1).data
        assertEquals(data, data.withSelection("nope"))
        assertNull(data.withSelection(null).settings.selectedServerId)
        val flipped = data.withSettings { it.copy(ipv6 = true) }
        assertTrue(flipped.settings.ipv6)
    }
}
