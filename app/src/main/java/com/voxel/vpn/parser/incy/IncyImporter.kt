package com.voxel.vpn.parser.incy

import com.voxel.vpn.model.ServerProfile
import com.voxel.vpn.model.SubscriptionMeta
import com.voxel.vpn.net.SubscriptionFetcher
import com.voxel.vpn.parser.LinkUri
import com.voxel.vpn.parser.RoutingDirective
import com.voxel.vpn.parser.SkippedEntry
import com.voxel.vpn.parser.SubscriptionBodyParser
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import java.io.IOException

/** One subscription (or bundle of pasted links) ready to be stored. */
data class ImportedSource(
    val title: String,
    /** Where it can be refreshed from; null for pasted links. */
    val url: String?,
    val origin: String,
    val servers: List<ServerProfile>,
    val meta: SubscriptionMeta,
    val skipped: List<SkippedEntry>,
    val routing: List<RoutingDirective>,
    val warnings: List<String>,
)

data class ImportFailure(val source: String, val message: String)

sealed interface ImportOutcome {
    data class Imported(val sources: List<ImportedSource>, val failures: List<ImportFailure>) : ImportOutcome

    /** The link was a control action (`incy://connect`, ...) rather than an import. */
    data class Control(val action: ControlAction) : ImportOutcome
}

/** Import failed as a whole; the message is meant for the user. */
class ImportException(message: String, cause: Throwable? = null) : Exception(message, cause)

/**
 * Orchestrates an import: classify the input ([IncyLinkParser]), download subscriptions
 * ([SubscriptionFetcher]) and parse their bodies ([SubscriptionBodyParser]).
 */
class IncyImporter(
    private val fetcher: SubscriptionFetcher,
    private val bodyParser: SubscriptionBodyParser = SubscriptionBodyParser(),
    private val maxParallelDownloads: Int = 4,
) {
    /**
     * @throws IncyLinkException when the link itself is not understood or cannot be decrypted
     * @throws ImportException when nothing could be imported
     */
    suspend fun import(input: String): ImportOutcome {
        return when (val command = IncyLinkParser.parse(input)) {
            is IncyCommand.Control -> ImportOutcome.Control(command.action)
            is IncyCommand.Inline -> importInline(command)
            is IncyCommand.Subscriptions -> importSubscriptions(command)
        }
    }

    /** Downloads [url] again, e.g. to refresh a stored subscription. */
    suspend fun fetchSubscription(url: String, nameHint: String? = null, origin: String = "refresh"): ImportedSource {
        val page = try {
            fetcher.fetch(url)
        } catch (e: IOException) {
            throw ImportException("Cannot download the subscription: ${e.message ?: e.javaClass.simpleName}", e)
        }
        if (page.status !in 200..299) {
            val hint = if (page.status == 404 || page.status == 410) " (the subscription no longer exists)" else ""
            throw ImportException("The server answered HTTP ${page.status}$hint")
        }
        val parsed = bodyParser.parse(page.body, page.headers)
        if (parsed.servers.isEmpty()) throw ImportException(emptyMessage(parsed.skipped))
        return ImportedSource(
            title = parsed.meta.title ?: nameHint ?: hostOf(url),
            url = url,
            origin = origin,
            servers = parsed.servers,
            meta = parsed.meta,
            skipped = parsed.skipped,
            routing = parsed.routing,
            warnings = parsed.warnings,
        )
    }

    private fun importInline(command: IncyCommand.Inline): ImportOutcome {
        val parsed = bodyParser.parse(command.text)
        if (parsed.servers.isEmpty()) throw ImportException(emptyMessage(parsed.skipped))
        val title = parsed.meta.title
            ?: if (parsed.servers.size == 1) parsed.servers.first().name else "Imported servers"
        val source = ImportedSource(
            title = title,
            url = null,
            origin = command.origin,
            servers = parsed.servers,
            meta = parsed.meta,
            skipped = parsed.skipped,
            routing = parsed.routing,
            warnings = parsed.warnings,
        )
        return ImportOutcome.Imported(listOf(source), emptyList())
    }

    private suspend fun importSubscriptions(command: IncyCommand.Subscriptions): ImportOutcome {
        val gate = Semaphore(maxParallelDownloads)
        val results = coroutineScope {
            command.urls.map { url ->
                async {
                    gate.withPermit {
                        try {
                            Result.success(fetchSubscription(url, command.nameHint, command.origin))
                        } catch (e: ImportException) {
                            Result.failure(e)
                        }
                    }
                }
            }.awaitAll()
        }
        val sources = ArrayList<ImportedSource>()
        val failures = ArrayList<ImportFailure>()
        results.forEachIndexed { index, result ->
            result.fold(
                onSuccess = { sources.add(it) },
                onFailure = { failures.add(ImportFailure(hostOf(command.urls[index]), it.message ?: "Import failed")) },
            )
        }
        if (sources.isEmpty()) {
            throw ImportException(failures.joinToString("\n") { "${it.source}: ${it.message}" })
        }
        return ImportOutcome.Imported(sources, failures)
    }

    private fun emptyMessage(skipped: List<SkippedEntry>): String {
        if (skipped.isEmpty()) return "No servers were found in the data"
        val reasons = skipped.map { it.reason }.groupingBy { it }.eachCount().entries
            .sortedByDescending { it.value }.take(3).joinToString("; ") { "${it.key} (${it.value})" }
        return "No supported servers found. Skipped: $reasons"
    }

    private fun hostOf(url: String): String = LinkUri.parse(url)?.host?.ifEmpty { null } ?: url.take(40)
}
