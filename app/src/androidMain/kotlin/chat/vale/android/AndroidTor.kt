package chat.vale.android

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import chat.vale.core.TorHandle
import org.torproject.jni.TorService
import java.io.File

/** Bound Tor service with a private v3 onion service and loopback-only SOCKS. */
internal class AndroidTor(
    private val context: Context,
    localPort: Int,
    socksPort: Int,
    private val onStatus: (String, String) -> Unit,
) : TorHandle {
    private val onionDirectory = File(context.noBackupFilesDir, "tor/onion")
    @Volatile private var closed = false
    @Volatile private var service: TorService? = null
    private var bound = false
    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            service = (binder as? TorService.LocalBinder)?.service
        }
        override fun onServiceDisconnected(name: ComponentName?) { service = null }
    }
    private val monitor: Thread

    init {
        require(localPort in 1..65535 && socksPort in 1..65535)
        check(onionDirectory.mkdirs() || onionDirectory.isDirectory)
        // Tor paths come only from app-private directories; no user input enters torrc.
        val onionPath = onionDirectory.absolutePath.replace("\\", "/").replace("\"", "")
        TorService.getTorrc(context).writeText(
            "SOCKSPort 127.0.0.1:$socksPort\nHTTPTunnelPort 0\nClientOnly 1\n" +
                "HiddenServiceDir \"$onionPath\"\nHiddenServiceVersion 3\nHiddenServicePort 45454 127.0.0.1:$localPort\n"
        )
        bound = context.bindService(Intent(context, TorService::class.java), connection, Context.BIND_AUTO_CREATE)
        if (!bound) onStatus("", "Не удалось запустить Tor")
        monitor = Thread({
            val startedAt = System.currentTimeMillis()
            while (!closed && bound) {
                try {
                    val hostname = File(onionDirectory, "hostname").takeIf { it.isFile }?.readText()?.trim().orEmpty()
                    val onion = hostname.takeIf { it.matches(Regex("[a-z2-7]{56}\\.onion")) }.orEmpty()
                    val phase = try { service?.torControlConnection?.getInfo("status/bootstrap-phase").orEmpty() } catch (_: Exception) { "" }
                    val ready = phase.contains("PROGRESS=100")
                    val status = when {
                        ready -> "Tor подключён"
                        System.currentTimeMillis() - startedAt > 120_000 -> "Tor пока не подключён; проверьте сеть"
                        else -> "Tor запускается"
                    }
                    onStatus(onion, status)
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
        if (bound) try { context.unbindService(connection) } catch (_: Exception) { }
        bound = false
        service = null
    }
}
