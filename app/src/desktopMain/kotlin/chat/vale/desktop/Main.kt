package chat.vale.desktop

import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isCtrlPressed
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.runtime.remember
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.WindowState
import androidx.compose.ui.window.application
import chat.vale.ValeApp
import chat.vale.core.Engine
import chat.vale.core.Crypto
import chat.vale.core.PlatformBridge
import com.github.sarxos.webcam.Webcam
import com.google.zxing.BinaryBitmap
import com.google.zxing.MultiFormatReader
import com.google.zxing.client.j2se.BufferedImageLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.goterl.lazysodium.LazySodiumJava
import com.goterl.lazysodium.SodiumJava
import java.awt.Toolkit
import java.awt.Desktop
import java.net.URI
import java.awt.datatransfer.StringSelection
import java.nio.file.Files
import javax.swing.SwingUtilities

fun main(args: Array<String>) {
    if (args.contains("--self-test")) {
        runtimeSelfTest()
        return
    }
    application {
    val bridge = remember { object : PlatformBridge {
        override val mobile = false
        override fun copyText(value: String) {
            Toolkit.getDefaultToolkit().systemClipboard.setContents(StringSelection(value), null)
        }
        override fun scanQr(onResult: (String?) -> Unit) {
            Thread({
                var result: String? = null
                val camera = try { Webcam.getDefault() } catch (_: Exception) { null }
                try {
                    if (camera != null && camera.open()) {
                        val deadline = System.currentTimeMillis() + 25_000
                        while (result == null && System.currentTimeMillis() < deadline) {
                            val image = camera.image
                            if (image != null) {
                                result = try { MultiFormatReader().decode(BinaryBitmap(HybridBinarizer(BufferedImageLuminanceSource(image)))).text }
                                catch (_: Exception) { null }
                            }
                            if (result == null) Thread.sleep(150)
                        }
                    }
                } catch (_: Exception) { /* permission, missing or busy webcam */ }
                finally { try { camera?.close() } catch (_: Exception) {} }
                val found = result
                SwingUtilities.invokeLater { onResult(found) }
            }, "vale-qr-scanner").apply { isDaemon = true; start() }
        }
        override fun openLocalPage(url: String): Boolean = try {
            if (!Desktop.isDesktopSupported()) false else { Desktop.getDesktop().browse(URI(url)); true }
        } catch (_: Exception) { false }
        override fun clearCache() { /* Media is served from memory, not an application media cache. */ }
        override fun setDisguised(enabled: Boolean) { /* Windows shortcut icons are not changed. */ }
    } }
    val engine = remember { Engine(LazySodiumJava(SodiumJava()), bridge, { DesktopVault() }) }
    Window(
        onCloseRequest = { engine.close(); exitApplication() },
        title = "Vale",
        state = WindowState(width = 1260.dp, height = 800.dp),
    ) {
        Box(Modifier.fillMaxSize().onPreviewKeyEvent { event ->
            if (event.type == KeyEventType.KeyDown && event.isCtrlPressed && event.isShiftPressed && event.key == Key.X) {
                engine.panic(); true
            } else false
        }) { ValeApp(engine) }
    }
}
}

/** Exercises native crypto, DPAPI and encrypted JDBC inside the packaged runtime. */
private fun runtimeSelfTest() {
    val directory = Files.createTempDirectory("vale-runtime-test-").toFile()
    try {
        val crypto = Crypto(LazySodiumJava(SodiumJava()))
        val alice = crypto.generateIdentity("Alice")
        val bob = crypto.generateIdentity("Bob")
        val now = System.currentTimeMillis()
        val packet = crypto.seal(alice, bob.publicKey, "runtime check", 60, now)
        check(crypto.open(bob, packet, now) == "runtime check")
        val vault = DesktopVault(directory)
        try { vault.write("runtime check"); check(vault.read() == "runtime check") }
        finally { vault.close() }
        val reopened = DesktopVault(directory)
        try { check(reopened.read() == "runtime check") }
        finally { reopened.close() }
        check(!String(directory.resolve("vale.db").readBytes(), Charsets.ISO_8859_1).contains("runtime check"))
    } finally { directory.deleteRecursively() }
}
