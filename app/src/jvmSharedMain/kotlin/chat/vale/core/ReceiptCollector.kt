package chat.vale.core

import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

/** One response per neighbor; invalid proofs cannot preempt a valid destination receipt. */
internal class ReceiptCollector(endpoints: Collection<String>, private val verify: (String) -> Boolean) {
    private val remaining = endpoints.toMutableSet()
    private val result = CompletableFuture<String?>()

    @Synchronized fun respond(endpoint: String, receipt: String?) {
        if (result.isDone || !remaining.remove(endpoint)) return
        val valid = receipt != null && try { verify(receipt) } catch (_: Exception) { false }
        if (valid) result.complete(receipt) else if (remaining.isEmpty()) result.complete(null)
    }

    fun await(seconds: Long): String? = try { result.get(seconds, TimeUnit.SECONDS) } catch (_: Exception) { null }
    fun cancel() { result.complete(null) }
}
