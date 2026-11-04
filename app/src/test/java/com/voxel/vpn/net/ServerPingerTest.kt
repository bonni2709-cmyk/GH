package com.voxel.vpn.net

import com.voxel.vpn.Samples
import com.voxel.vpn.model.ServerProfile
import com.voxel.vpn.parser.LinkParseResult
import com.voxel.vpn.parser.ShareLinkParser
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.net.InetAddress
import java.net.ServerSocket
import kotlin.concurrent.thread

class ServerPingerTest {
    private lateinit var listener: ServerSocket
    private lateinit var acceptor: Thread

    @Before
    fun start() {
        listener = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))
        acceptor = thread(isDaemon = true) {
            try {
                while (true) listener.accept().close()
            } catch (_: java.io.IOException) {
            }
        }
    }

    @After
    fun stop() {
        listener.close()
    }

    private fun profile(host: String, port: Int, extra: String = ""): ServerProfile {
        val r = ShareLinkParser.parse("vless://${Samples.UUID}@$host:$port?security=none$extra#t")
        return (r as? LinkParseResult.Ok)?.profile ?: throw AssertionError("cannot build profile: $r")
    }

    private fun closedPort(): Int = ServerSocket(0, 1, InetAddress.getByName("127.0.0.1")).use { it.localPort }

    @Test
    fun reachableServerReportsALatency() = runBlocking {
        val result = ServerPinger(timeoutMs = 1500).pingOne(profile("127.0.0.1", listener.localPort))
        assertTrue(result.reachable)
        assertNotNull(result.ms)
        assertTrue(result.ms!! in 1..1500)
    }

    @Test
    fun closedPortIsUnreachable() = runBlocking {
        val result = ServerPinger(timeoutMs = 1000).pingOne(profile("127.0.0.1", closedPort()))
        assertFalse(result.reachable)
        assertNull(result.ms)
        assertNotNull(result.error)
    }

    @Test
    fun hostNamesAreResolvedThroughTheResolver() = runBlocking {
        val resolver = object : HostResolver {
            override suspend fun resolve(host: String, ipv6: Boolean): List<String> = if (host == "node.test") listOf("127.0.0.1") else emptyList()
        }
        val pinger = ServerPinger(timeoutMs = 1500, resolver = resolver)
        val vless = ShareLinkParser.parse("vless://${Samples.UUID}@node.test:${listener.localPort}?security=tls&sni=node.test#n") as LinkParseResult.Ok
        assertTrue(pinger.pingOne(vless.profile).reachable)
        val missing = ShareLinkParser.parse("vless://${Samples.UUID}@nope.test:443?security=tls&sni=nope.test#n") as LinkParseResult.Ok
        val result = pinger.pingOne(missing.profile)
        assertFalse(result.reachable)
        assertEquals("DNS lookup failed", result.error)
    }

    @Test
    fun udpBasedServersAreNotApplicable() = runBlocking {
        val kcp = profile("127.0.0.1", listener.localPort, "&type=kcp")
        assertEquals(PingResult.NOT_APPLICABLE, ServerPinger().pingOne(kcp))
    }

    @Test
    fun pingingManyReportsEachResultOnce() = runBlocking {
        val good = profile("127.0.0.1", listener.localPort)
        val good2 = profile("127.0.0.1", listener.localPort, "&type=ws&path=%2Fx")
        val bad = profile("127.0.0.1", closedPort())
        val seen = java.util.Collections.synchronizedList(ArrayList<String>())
        val results = ServerPinger(timeoutMs = 1000, concurrency = 2).ping(listOf(good, bad, good2)) { id, _ -> seen.add(id) }
        assertEquals(3, results.size)
        assertTrue(results.getValue(good.id).reachable)
        assertFalse(results.getValue(bad.id).reachable)
        assertEquals(results.size, seen.size)
    }

    @Test
    fun dohAnswersAreParsedByRecordType() {
        val json = """{"Status":0,"Answer":[{"name":"x.test","type":5,"TTL":1,"data":"y.test."},{"name":"y.test","type":1,"TTL":1,"data":"93.184.216.34"},{"name":"y.test","type":28,"TTL":1,"data":"2606:2800::1"}]}"""
        assertEquals(listOf("93.184.216.34"), DohHostResolver.parseAnswers(json, 1))
        assertEquals(listOf("2606:2800::1"), DohHostResolver.parseAnswers(json, 28))
        assertEquals(emptyList<String>(), DohHostResolver.parseAnswers("""{"Status":3}""", 1))
        assertEquals(emptyList<String>(), DohHostResolver.parseAnswers("garbage", 1))
    }

    @Test
    fun chainFallsThroughToTheFirstAnswer() = runBlocking {
        val empty = object : HostResolver {
            override suspend fun resolve(host: String, ipv6: Boolean) = emptyList<String>()
        }
        val fixed = object : HostResolver {
            override suspend fun resolve(host: String, ipv6: Boolean) = listOf("10.0.0.1")
        }
        assertEquals(listOf("10.0.0.1"), ChainHostResolver(empty, fixed).resolve("x"))
        assertEquals(emptyList<String>(), ChainHostResolver(empty, empty).resolve("x"))
    }

    @Test
    fun systemResolverResolvesLocalhostAndGivesUpOnGarbage() = runBlocking {
        val resolver = SystemHostResolver(timeoutMs = 3000)
        assertTrue(resolver.resolve("localhost").contains("127.0.0.1"))
        assertTrue(resolver.resolve("definitely-not-a-host.invalid").isEmpty())
    }
}
