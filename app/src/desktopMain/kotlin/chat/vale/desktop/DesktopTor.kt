package chat.vale.desktop

import chat.vale.core.TorHandle
import java.io.File
import java.util.concurrent.TimeUnit

internal fun packagedTorExecutable(): File? {
    val override = System.getenv("VALE_TOR_EXECUTABLE")?.let(::File)
    if (override?.isFile == true) return override
    val resources = System.getProperty("compose.application.resources.dir")?.let(::File) ?: return null
    return resources.resolve("tor-bundle").walkTopDown().maxDepth(4).firstOrNull { it.isFile && it.name.equals("tor.exe", true) }
}

/** Runs the pinned Tor Expert Bundle; Tor-only mode never falls back to LAN. */
internal class DesktopTor(localPort: Int, socksPort: Int, private val onStatus: (String, String) -> Unit) : TorHandle {
    private val directory = File(System.getenv("LOCALAPPDATA") ?: error("LOCALAPPDATA unavailable"), "Vale/tor")
    private val onionDirectory = directory.resolve("onion")
    private val process: Process
    private val monitor: Thread
    @Volatile private var closed = false
    @Volatile private var ready = false

    init {
        require(localPort in 1..65535 && socksPort in 1..65535)
        val executable = packagedTorExecutable() ?: error("Tor binary is missing")
        check(onionDirectory.mkdirs() || onionDirectory.isDirectory)
        val data = directory.resolve("data").apply { mkdirs() }
        fun path(file: File): String = "\"" + file.absolutePath.replace('\\', '/').replace("\"", "") + "\""
        val config = directory.resolve("torrc")
        config.writeText("SOCKSPort 127.0.0.1:$socksPort\nClientOnly 1\nRunAsDaemon 0\n" +
            "DataDirectory ${path(data)}\nHiddenServiceDir ${path(onionDirectory)}\nHiddenServiceVersion 3\n" +
            "HiddenServicePort 45454 127.0.0.1:$localPort\n")
        process = ProcessBuilder(executable.absolutePath, "-f", config.absolutePath)
            .directory(executable.parentFile).redirectErrorStream(true).start()
        Thread({
            try {
                process.inputStream.bufferedReader().useLines { lines ->
                    lines.forEach { if (it.contains("Bootstrapped 100%")) ready = true }
                }
            } catch (_: Exception) { }
        }, "vale-tor-log").apply { isDaemon = true; start() }
        monitor = Thread({
            while (!closed) {
                try {
                    if (!process.isAlive) { onStatus("", "Tor остановился"); break }
                    val hostname = onionDirectory.resolve("hostname").takeIf { it.isFile }?.readText()?.trim().orEmpty()
                    val onion = hostname.takeIf { it.matches(Regex("[a-z2-7]{56}\\.onion")) }.orEmpty()
                    onStatus(onion, if (ready) "Tor подключён" else "Tor запускается")
                    Thread.sleep(2_000)
                } catch (_: InterruptedException) { break }
                catch (_: Exception) { if (!closed) onStatus("", "Tor запускается") }
            }
        }, "vale-tor-status").apply { isDaemon = true; start() }
    }

    override fun close() {
        if (closed) return
        closed = true
        monitor.interrupt()
        process.destroy()
        try { if (!process.waitFor(2, TimeUnit.SECONDS)) process.destroyForcibly() } catch (_: Exception) { process.destroyForcibly() }
    }
}
