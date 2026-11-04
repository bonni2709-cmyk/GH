package com.voxel.vpn.parser

import com.voxel.vpn.Samples
import com.voxel.vpn.expectThrows
import com.voxel.vpn.net.FetchException
import com.voxel.vpn.net.FetchedPage
import com.voxel.vpn.net.SubscriptionFetcher
import com.voxel.vpn.parser.incy.ControlAction
import com.voxel.vpn.parser.incy.ImportException
import com.voxel.vpn.parser.incy.ImportOutcome
import com.voxel.vpn.parser.incy.IncyCrypt1
import com.voxel.vpn.parser.incy.IncyImporter
import com.voxel.vpn.parser.incy.IncyLinkException
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class IncyImporterTest {
    private class FakeFetcher(private val pages: Map<String, () -> FetchedPage>) : SubscriptionFetcher {
        val requested = ArrayList<String>()

        override suspend fun fetch(url: String): FetchedPage {
            synchronized(requested) { requested.add(url) }
            return (pages[url] ?: throw FetchException(null, "connection refused"))()
        }
    }

    private fun page(url: String, body: String, status: Int = 200, headers: Map<String, String> = emptyMap()) =
        { FetchedPage(url, status, headers, body) }

    private val subUrl = "https://sub.example.com/a?token=1"
    private val body = Base64Codec.encodeStandard("${Samples.VLESS_REALITY}\n${Samples.VLESS_WS_TLS}\n".toByteArray())

    private fun importer(vararg pages: Pair<String, () -> FetchedPage>) = IncyImporter(FakeFetcher(mapOf(*pages)))

    private fun imported(outcome: ImportOutcome) = outcome as? ImportOutcome.Imported ?: throw AssertionError("expected Imported: $outcome")

    @Test
    fun crypt1LinkIsDecryptedDownloadedAndParsed() = runBlocking {
        val fetcher = FakeFetcher(mapOf(subUrl to page(subUrl, body, headers = mapOf("profile-title" to "Header Title", "profile-update-interval" to "8"))))
        val result = imported(IncyImporter(fetcher).import(IncyCrypt1.encode(subUrl, "Hint")))
        assertEquals(listOf(subUrl), fetcher.requested)
        val source = result.sources.single()
        assertEquals("Header Title", source.title)
        assertEquals(subUrl, source.url)
        assertEquals("incy:crypt1", source.origin)
        assertEquals(2, source.servers.size)
        assertEquals(8, source.meta.updateIntervalHours)
        assertTrue(result.failures.isEmpty())
    }

    @Test
    fun nameHintIsUsedWhenTheProviderSendsNoTitle() = runBlocking {
        val result = imported(importer(subUrl to page(subUrl, body)).import(IncyCrypt1.encode(subUrl, "My Hint")))
        assertEquals("My Hint", result.sources.single().title)
        val noHint = imported(importer(subUrl to page(subUrl, body)).import("incy://add/$subUrl"))
        assertEquals("sub.example.com", noHint.sources.single().title)
    }

    @Test
    fun addAndPlainUrlsWork() = runBlocking {
        val i = importer(subUrl to page(subUrl, body))
        assertEquals(2, imported(i.import("incy://add/$subUrl")).sources.single().servers.size)
        assertEquals("paste", imported(i.import(subUrl)).sources.single().origin)
    }

    @Test
    fun httpErrorsAreReportedForHumans() = runBlocking {
        val gone = expectThrowsSuspend<ImportException> { importer(subUrl to page(subUrl, "", status = 404)).import("incy://add/$subUrl") }
        assertTrue(gone.message!!.contains("404"))
        assertTrue(gone.message!!.contains("no longer exists"))
        val boom = expectThrowsSuspend<ImportException> { importer(subUrl to page(subUrl, "", status = 503)).import("incy://add/$subUrl") }
        assertTrue(boom.message!!.contains("503"))
        val offline = expectThrowsSuspend<ImportException> { importer().import("incy://add/$subUrl") }
        assertTrue(offline.message!!.contains("connection refused"))
    }

    @Test
    fun emptyOrUnsupportedBodiesExplainWhy() = runBlocking {
        val empty = expectThrowsSuspend<ImportException> { importer(subUrl to page(subUrl, "")).import("incy://add/$subUrl") }
        assertTrue(empty.message!!.contains("No servers"))
        val ssr = expectThrowsSuspend<ImportException> {
            importer(subUrl to page(subUrl, "ssr://aaa\nssr://bbb\ntuic://u:p@h:1")).import("incy://add/$subUrl")
        }
        assertTrue(ssr.message!!.contains("ShadowsocksR is not supported (2)"))
    }

    @Test
    fun severalSubscriptionsKeepPartialFailures() = runBlocking {
        val a = "https://a.example/s"
        val b = "https://b.example/s"
        val c = "https://c.example/s"
        val i = importer(a to page(a, body), c to page(c, Samples.VLESS_REALITY))
        val result = imported(i.import("$a\n$b\n$c"))
        assertEquals(2, result.sources.size)
        assertEquals(listOf("a.example", "c.example").sorted(), result.sources.map { it.url!!.substringAfter("://").substringBefore('/') }.sorted())
        assertEquals(1, result.failures.size)
        assertEquals("b.example", result.failures.single().source)
        assertTrue(result.failures.single().message.contains("connection refused"))
    }

    @Test
    fun allSubscriptionsFailing() = runBlocking {
        val e = expectThrowsSuspend<ImportException> { importer().import("https://a.example/s\nhttps://b.example/s") }
        assertTrue(e.message!!.contains("a.example"))
        assertTrue(e.message!!.contains("b.example"))
    }

    @Test
    fun inlineLinksNeedNoNetwork() = runBlocking {
        val fetcher = FakeFetcher(emptyMap())
        val one = imported(IncyImporter(fetcher).import(Samples.VLESS_REALITY)).sources.single()
        assertEquals("Reality NL", one.title)
        assertNull(one.url)
        assertEquals("paste", one.origin)
        val two = imported(IncyImporter(fetcher).import("incy://import/" + Base64Codec.encodeUrlSafe("${Samples.VLESS_REALITY}\n${Samples.VLESS_WS_TLS}".toByteArray())))
        assertEquals("Imported servers", two.sources.single().title)
        assertEquals(2, two.sources.single().servers.size)
        assertTrue(fetcher.requested.isEmpty())
    }

    @Test
    fun controlLinksAreReturnedAsIs() = runBlocking {
        assertEquals(ImportOutcome.Control(ControlAction.TOGGLE), importer().import("incy://toggle"))
    }

    @Test
    fun brokenLinksSurfaceTheirOwnErrors() = runBlocking {
        val e = expectThrowsSuspend<IncyLinkException> { importer().import("incy://crypt2/abc") }
        assertEquals(IncyLinkException.Kind.UNSUPPORTED_VERSION, e.kind)
    }

    @Test
    fun refreshingAStoredSubscription() = runBlocking {
        val i = importer(subUrl to page(subUrl, body, headers = mapOf("subscription-userinfo" to "upload=1; download=2; total=3")))
        val source = i.fetchSubscription(subUrl, origin = "refresh")
        assertEquals("refresh", source.origin)
        assertEquals(3L, source.meta.userInfo!!.total)
    }

    private suspend inline fun <reified T : Throwable> expectThrowsSuspend(crossinline block: suspend () -> Unit): T {
        try {
            block()
        } catch (e: Throwable) {
            if (e is T) return e
            throw AssertionError("Expected ${T::class.java.simpleName} but got $e", e)
        }
        throw AssertionError("Expected ${T::class.java.simpleName} but nothing was thrown")
    }
}
