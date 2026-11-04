package com.voxel.vpn.model

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelsTest {
    private val json = Json { encodeDefaults = true; ignoreUnknownKeys = true }

    private fun vless(address: String = "h.example.com", port: Int = 443) = buildJsonObject {
        put("protocol", "vless")
        putJsonObject("settings") {
            put("address", address)
            put("port", port)
            put("id", "x")
            put("encryption", "none")
        }
    }

    @Test
    fun canonicalJsonSortsKeysRecursively() {
        val a = Json.parseToJsonElement("""{"b":1,"a":{"d":[1,{"z":1,"y":2}],"c":"x"}}""")
        val b = Json.parseToJsonElement("""{"a":{"c":"x","d":[1,{"y":2,"z":1}]},"b":1}""")
        assertEquals(a.canonical(), b.canonical())
        assertEquals("""{"a":{"c":"x","d":[1,{"y":2,"z":1}]},"b":1}""", a.canonical())
    }

    @Test
    fun endpointIsReadFromEveryOutboundShape() {
        val vnext = Json.parseToJsonElement("""{"protocol":"vmess","settings":{"vnext":[{"address":"v.example.com","port":"8443","users":[]}]}}""").jsonObject
        assertEquals("v.example.com" to 8443, ServerProfile.fromOutbound(vnext, null)!!.let { it.host to it.port })

        val servers = Json.parseToJsonElement("""{"protocol":"trojan","settings":{"servers":[{"address":"t.example.com","port":443,"password":"p"}]}}""").jsonObject
        assertEquals("t.example.com", ServerProfile.fromOutbound(servers, null)!!.host)

        val wg = Json.parseToJsonElement("""{"protocol":"wireguard","settings":{"secretKey":"k","peers":[{"publicKey":"p","endpoint":"[2001:db8::1]:51820"}]}}""").jsonObject
        val wgProfile = ServerProfile.fromOutbound(wg, "wg")!!
        assertEquals("2001:db8::1", wgProfile.host)
        assertEquals(51820, wgProfile.port)
        assertFalse(wgProfile.tcpProbeable)

        val bracketed = buildJsonObject {
            put("protocol", "socks")
            putJsonObject("settings") {
                put("address", "[::1]")
                put("port", 1080)
            }
        }
        assertEquals("::1", ServerProfile.fromOutbound(bracketed, null)!!.host)

        assertNull(ServerProfile.fromOutbound(buildJsonObject { put("protocol", "freedom") }, null))
        assertNull(ServerProfile.fromOutbound(buildJsonObject { put("settings", buildJsonObject { }) }, null))
    }

    @Test
    fun networkAndSecurityDefaultsAndTcpProbing() {
        val p = ServerProfile.fromOutbound(vless(), "n")!!
        assertEquals("tcp", p.network)
        assertEquals("none", p.security)
        assertTrue(p.tcpProbeable)
        val kcp = buildJsonObject {
            put("protocol", "vless")
            putJsonObject("settings") {
                put("address", "h")
                put("port", 1)
            }
            putJsonObject("streamSettings") { put("network", "kcp") }
        }
        assertFalse(ServerProfile.fromOutbound(kcp, null)!!.tcpProbeable)
    }

    @Test
    fun idsDependOnTheOutboundNotTheName() {
        val a = ServerProfile.fromOutbound(vless(), "one")!!
        val b = ServerProfile.fromOutbound(vless(), "two")!!
        val c = ServerProfile.fromOutbound(vless(port = 444), "one")!!
        assertEquals(a.id, b.id)
        assertFalse(a.id == c.id)
        assertEquals(16, a.id.length)
    }

    @Test
    fun namesAreSanitised() {
        assertNull(ServerProfile.sanitizeName(null))
        assertNull(ServerProfile.sanitizeName("  \n\t "))
        assertEquals("a b c", ServerProfile.sanitizeName("a\u0000 b\n\nc "))
        assertEquals(100, ServerProfile.sanitizeName("y".repeat(250))!!.length)
    }

    @Test
    fun attachToIsStablePerSubscription() {
        val p = ServerProfile.fromOutbound(vless(), "n")!!
        assertEquals(p.attachTo("s1").id, p.attachTo("s1").id)
        assertFalse(p.attachTo("s1").id == p.attachTo("s2").id)
        assertEquals("s1", p.attachTo("s1").subscriptionId)
    }

    @Test
    fun appDataSurvivesAJsonRoundTrip() {
        val server = ServerProfile.fromOutbound(vless(), "Node", now = 5)!!.attachTo("sub")
        val data = AppData(
            subscriptions = listOf(
                Subscription(
                    id = "sub", title = "T", url = "https://x.example/s", origin = "incy:crypt1", updatedAt = 9,
                    meta = SubscriptionMeta(title = "T", userInfo = UserInfo(1, 2, 3, 4), updateIntervalHours = 12, extra = mapOf("k" to "v")),
                ),
            ),
            servers = listOf(server),
            settings = AppSettings(selectedServerId = server.id, ipv6 = true),
        )
        val text = json.encodeToString(AppData.serializer(), data)
        val back = json.decodeFromString(AppData.serializer(), text)
        assertEquals(data, back)
        assertEquals(server, back.server(server.id))
        assertEquals(listOf(server), back.serversOf("sub"))
        assertNull(back.server("missing"))
        assertNull(back.server(null))
        assertEquals(3L, back.subscriptions.single().meta.userInfo!!.used)
    }

    @Test
    fun oldFilesWithMissingFieldsStillLoad() {
        val back = json.decodeFromString(AppData.serializer(), """{"settings":{"ipv6":true},"unknown":1}""")
        assertTrue(back.settings.ipv6)
        assertTrue(back.servers.isEmpty())
        assertNotNull(back.settings.logLevel)
    }

    @Test
    fun endpointBracketsIpv6() {
        val p = ServerProfile.fromOutbound(vless(address = "2001:db8::1"), "v6")!!
        assertEquals("[2001:db8::1]:443", p.endpoint)
    }
}
