package com.voxel.vpn.data

import com.voxel.vpn.model.AppData
import com.voxel.vpn.model.AppSettings
import com.voxel.vpn.model.Hashing
import com.voxel.vpn.model.Subscription
import com.voxel.vpn.parser.incy.ImportedSource

/** Id of the single group that collects servers added from literal links. */
const val LOCAL_SUBSCRIPTION_ID = "local"

/** What [withSource] did: the new data, the stored subscription and how many servers were new. */
data class SourceMerge(
    val data: AppData,
    val subscription: Subscription,
    val newServers: Int,
    val refreshed: Boolean,
)

/**
 * Stores [source]. A remote subscription is identified by its URL: importing it again replaces its servers.
 * Servers from literal links all go to one local group and accumulate there.
 */
fun AppData.withSource(source: ImportedSource, now: Long): SourceMerge {
    val url = source.url
    val local = url == null
    val subscriptionId = if (url == null) LOCAL_SUBSCRIPTION_ID else Hashing.shortId("url|" + url.trim())
    val existing = subscriptions.firstOrNull { it.id == subscriptionId }
    val previous = serversOf(subscriptionId)
    val previousById = previous.associateBy { it.id }

    val incoming = source.servers
        .map { it.attachTo(subscriptionId) }
        .distinctBy { it.id }
        .map { server -> server.copy(addedAt = previousById[server.id]?.addedAt ?: now) }

    val mergedServers = if (local) {
        val fresh = incoming.map { it.id }.toSet()
        previous.filter { it.id !in fresh } + incoming
    } else {
        incoming
    }

    val origin = if (source.origin == "refresh" && existing != null) existing.origin else source.origin
    val subscription = Subscription(
        id = subscriptionId,
        title = if (local) existing?.title ?: source.title else source.title,
        url = url,
        origin = origin,
        updatedAt = now,
        meta = source.meta,
    )

    val subscriptionsNext = if (existing == null) {
        subscriptions + subscription
    } else {
        subscriptions.map { if (it.id == subscriptionId) subscription else it }
    }
    val serversNext = servers.filter { it.subscriptionId != subscriptionId } + mergedServers
    val merged = copy(subscriptions = subscriptionsNext, servers = serversNext).withValidSelection(mergedServers.firstOrNull()?.id)
    val newCount = incoming.count { it.id !in previousById }
    return SourceMerge(merged, subscription, newCount, refreshed = existing != null)
}

/** Removes a subscription together with its servers. */
fun AppData.withoutSubscription(subscriptionId: String): AppData =
    copy(
        subscriptions = subscriptions.filter { it.id != subscriptionId },
        servers = servers.filter { it.subscriptionId != subscriptionId },
    ).withValidSelection(null)

/** Removes one server; an emptied local group disappears with it. */
fun AppData.withoutServer(serverId: String): AppData {
    val target = server(serverId) ?: return this
    val remaining = servers.filter { it.id != serverId }
    val groupEmpty = remaining.none { it.subscriptionId == target.subscriptionId }
    val keepSubscriptions = if (groupEmpty && target.subscriptionId == LOCAL_SUBSCRIPTION_ID) {
        subscriptions.filter { it.id != LOCAL_SUBSCRIPTION_ID }
    } else {
        subscriptions
    }
    return copy(subscriptions = keepSubscriptions, servers = remaining).withValidSelection(null)
}

/** Selects [serverId] when such a server exists; otherwise leaves the data unchanged. */
fun AppData.withSelection(serverId: String?): AppData =
    if (serverId == null || server(serverId) != null) copy(settings = settings.copy(selectedServerId = serverId)) else this

fun AppData.withSettings(transform: (AppSettings) -> AppSettings): AppData = copy(settings = transform(settings))

/** Keeps the selected server if it still exists; otherwise falls back to [fallback] or the first server. */
private fun AppData.withValidSelection(fallback: String?): AppData {
    val current = settings.selectedServerId
    if (current != null && server(current) != null) return this
    val next = fallback?.takeIf { server(it) != null } ?: servers.firstOrNull()?.id
    return copy(settings = settings.copy(selectedServerId = next))
}
