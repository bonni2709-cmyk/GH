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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.WindowState
import androidx.compose.ui.window.application
import chat.vale.ValeApp
import chat.vale.core.Engine
import chat.vale.core.PlatformBridge
import com.github.sarxos.webcam.Webcam
import com.google.zxing.BinaryBitmap
import com.google.zxing.MultiFormatReader
import com.google.zxing.client.j2se.BufferedImageLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.goterl.lazysodium.LazySodiumJava
import com.goterl.lazysodium.SodiumJava
import java.awt.Toolkit
import java.awt.datatransfer.StringSelection
import javax.swing.SwingUtilities

fun main() = application {
    val bridge = object : PlatformBridge {
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
        override fun clearCache() { /* The desktop app does not keep an application media cache. */ }
        override fun setDisguised(enabled: Boolean) { /* Windows shortcut icons are not changed. */ }
    }
    val engine = Engine(LazySodiumJava(SodiumJava()), bridge, { DesktopVault() })
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
