package com.voxel.vpn.net

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.MalformedURLException
import java.net.URL
import java.util.zip.GZIPInputStream
import java.util.zip.InflaterInputStream

/** A downloaded subscription page. [headers] are keyed in lower case. */
data class FetchedPage(val finalUrl: String, val status: Int, val headers: Map<String, String>, val body: String)

class FetchException(val status: Int?, message: String, cause: Throwable? = null) : IOException(message, cause)

interface SubscriptionFetcher {
    suspend fun fetch(url: String): FetchedPage
}

/**
 * Downloads subscriptions with `HttpURLConnection`: manual redirects (never from HTTPS to HTTP),
 * gzip/deflate, timeouts and a hard size cap so a hostile server cannot exhaust memory.
 */
class HttpSubscriptionFetcher(
    private val userAgent: String,
    private val extraHeaders: Map<String, String> = emptyMap(),
    private val connectTimeoutMs: Int = 10_000,
    private val readTimeoutMs: Int = 20_000,
    private val maxBytes: Int = 8 * 1024 * 1024,
    private val maxRedirects: Int = 5,
) : SubscriptionFetcher {

    override suspend fun fetch(url: String): FetchedPage = withContext(Dispatchers.IO) { fetchBlocking(url) }

    internal fun fetchBlocking(url: String): FetchedPage {
        var current = try {
            URL(url.trim())
        } catch (e: MalformedURLException) {
            throw FetchException(null, "Not a valid URL: $url", e)
        }
        if (current.protocol != "http" && current.protocol != "https") {
            throw FetchException(null, "Unsupported URL scheme '${current.protocol}'")
        }

        var redirects = 0
        while (true) {
            val connection = current.openConnection() as HttpURLConnection
            try {
                connection.instanceFollowRedirects = false
                connection.connectTimeout = connectTimeoutMs
                connection.readTimeout = readTimeoutMs
                connection.requestMethod = "GET"
                connection.setRequestProperty("User-Agent", userAgent)
                connection.setRequestProperty("Accept", "*/*")
                connection.setRequestProperty("Accept-Encoding", "gzip")
                extraHeaders.forEach { (k, v) -> connection.setRequestProperty(k, v) }

                val code = connection.responseCode
                val location = connection.getHeaderField("Location")
                if (code in 300..399 && location != null) {
                    if (++redirects > maxRedirects) throw FetchException(code, "Too many redirects")
                    val next = try {
                        URL(current, location)
                    } catch (e: MalformedURLException) {
                        throw FetchException(code, "Bad redirect target: $location", e)
                    }
                    if (next.protocol != "http" && next.protocol != "https") {
                        throw FetchException(code, "Refusing redirect to the '${next.protocol}' scheme")
                    }
                    if (current.protocol == "https" && next.protocol == "http") {
                        throw FetchException(code, "Refusing redirect from HTTPS to HTTP")
                    }
                    current = next
                    continue
                }

                val headers = HashMap<String, String>()
                for ((key, values) in connection.headerFields) {
                    if (key != null && values.isNotEmpty()) headers[key.lowercase()] = values.first()
                }
                val raw = (if (code >= 400) connection.errorStream else connection.inputStream)
                val body = if (raw == null) {
                    ""
                } else {
                    raw.use { String(readLimited(decoded(it, headers["content-encoding"])), Charsets.UTF_8) }
                }
                return FetchedPage(current.toString(), code, headers, body)
            } finally {
                connection.disconnect()
            }
        }
    }

    private fun decoded(stream: InputStream, encoding: String?): InputStream = when (encoding?.trim()?.lowercase()) {
        "gzip", "x-gzip" -> GZIPInputStream(stream)
        "deflate" -> InflaterInputStream(stream)
        else -> stream
    }

    private fun readLimited(stream: InputStream): ByteArray {
        val out = ByteArrayOutputStream()
        val buffer = ByteArray(16 * 1024)
        var total = 0
        while (true) {
            val n = stream.read(buffer)
            if (n < 0) break
            total += n
            if (total > maxBytes) throw FetchException(null, "The response is larger than ${maxBytes / (1024 * 1024)} MB")
            out.write(buffer, 0, n)
        }
        return out.toByteArray()
    }
}
